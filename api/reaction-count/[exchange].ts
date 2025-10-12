/**
 * Slack Reaction Count API Endpoint
 * 
 * Exchanges OAuth authorization code for Slack access token, then fetches and aggregates
 * all reaction data from user's messages. Returns sorted emoji reaction counts with 
 * custom emoji URLs for visualization.
 * 
 *  1. Authenticate user via OAuth code exchange
 *  2. Fetch image url of custom emojis
 *  3. Fetch all messages with reactions using Slack Search API
 *  4. For each message, retrieve reactions and aggregate counts
 *  5. Sort and format results, including custom emoji URLs 
 *  6. Return JSON response with reaction counts and emoji URLs
 */

const { WebClient, ErrorCode, LogLevel } = require('@slack/web-api');
import { jwtDecode } from "jwt-decode";
import * as emoji from 'node-emoji'
import getConcurrentRequests, { type AsyncFunction } from "../../utils/getConcurrentRequests";


const appToken = process.env.SLACK_TOKEN;
const clientSecret = process.env.CLIENT_SECRET;
const web = new WebClient(appToken, {
    loglLevel: LogLevel.DEBUG
});

interface Message {
    channel: string;
    timestamp: string;
}
interface SlackSearchMatch {
    channel: {
        id: string;
    };
    ts: string;
}
interface GetMessagesResult {
    messages: Message[];
    totalPages: number;
}

interface GetReactionsResult {
    name: string;
    count: number;
}

interface TotalReactions {
    [key: string]: number;
}

interface SlackJWTPayload {
    "https://slack.com/user_id": string;
    [key: string]: any;
}

const getMessages = async (token: string, userId: string, page: number): Promise<GetMessagesResult> => {
    const messagesWithReactions = await web.search.messages({
        token,
        query: `from:${userId} has:reaction`,
        count: 100,
        page
    });

    const messages: Message[] = messagesWithReactions.messages.matches.map((match: SlackSearchMatch) => ({
        channel: match.channel.id,
        timestamp: match.ts
    }));

    return { messages, totalPages: messagesWithReactions.messages.paging.pages };
};

const getReactions = async (token: string, channel: string, timestamp: string): Promise<GetReactionsResult[]> => {
    try {
        const reactions = await web.reactions.get({
            token,
            channel,
            timestamp
        })

        return reactions.message.reactions;
    } catch (error) {
        console.log('Reaction ERROR: ', error);

        return [];
    }
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const exchange = url.searchParams.get('exchange');

    // Authenticate user
    const {id_token: jwt, access_token: accessToken} = await web.openid.connect.token({
        "client_id": "9157193857749.9152727733619",
        "client_secret": clientSecret,
        "grant_type": "authorization_code",
        code: exchange
    });

    // Get user ID from the ID Token
    const {"https://slack.com/user_id": userId } = jwtDecode<SlackJWTPayload>(jwt);

    // Get custom emojies
    const emojis = await web.emoji.list({token: accessToken});
    console.log(emojis);

    const startTime = Date.now();
    console.log("// Start: ", startTime);

    // Get first page of messages with reactions
    let { messages, totalPages } = await getMessages(accessToken, userId, 1);
    
    // Send off a request for the rest of the pages
    const additionalMessagesRequests: AsyncFunction<GetMessagesResult>[] = [];
    if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
            additionalMessagesRequests.push(() => getMessages(accessToken, userId, page));
        }
    }
    const pages = await getConcurrentRequests(additionalMessagesRequests, 10); // Batch 10 requests at a time to maximize performance with rate limits
    pages.map(({ messages: additionalMessages }) => {
        messages = messages.concat(additionalMessages);
    });

    console.log("// Messages: ", messages.length, Date.now() - startTime);

    // Get reactions for each message
    const allReactions = await getConcurrentRequests(messages.map(({ channel, timestamp }) => () => getReactions(accessToken, channel, timestamp)), 25); // Batch 25 requests at a time to maximize performance with rate limits
    
    let totalReactions: TotalReactions = {};   
    const reactions = allReactions.flat();
    reactions.forEach(({ name, count }) => {
        const currentCount = totalReactions[name];
        if (currentCount) {
            return totalReactions[name] = currentCount + count;
        }
        return totalReactions[name] = count;
    });

    const sortedResponse = Object.entries(totalReactions).sort((a, b) => b[1] - a[1]).map(reaction => ({emoji: emoji.get(reaction[0]) ?? emoji.get(reaction[0].replace('-', '_')) ?? reaction[0], count: reaction[1], emojiUrl: emojis.emoji[reaction[0]]}));

    console.log("// Reactions: ", Date.now() - startTime);

    return new Response(JSON.stringify(sortedResponse));
}