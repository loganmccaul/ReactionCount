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

const { WebClient } = require('@slack/web-api');
import { jwtDecode } from "jwt-decode";
import * as emoji from 'node-emoji'
import getConcurrentRequests, { type AsyncFunction } from "../../utils/getConcurrentRequests";
import { LogLevel } from "@slack/web-api";


const clientSecret = process.env.CLIENT_SECRET;
const clientId = process.env.CLIENT_ID;

const web = new WebClient(null, {
    rejectRateLimitedCalls: true,
    logLevel: LogLevel.ERROR,
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
    const ninetydaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const messagesWithReactions = await web.search.messages({
        token,
        query: `from:${userId} has:reaction after:${ninetydaysAgo}`,
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
    const reactions = await web.reactions.get({
        token,
        channel,
        timestamp
    })

    return reactions.message.reactions;
};

export async function GET(request: Request) {
    const url = new URL(request.url);
    const exchange = url.searchParams.get('exchange');

    // Authenticate user
    const { id_token: jwt, access_token: accessToken } = await (new WebClient()).openid.connect.token({
        "client_id": clientId,
        "client_secret": clientSecret,
        "grant_type": "authorization_code",
        code: exchange
    });

    // Get user ID from the ID Token
    const {"https://slack.com/user_id": userId } = jwtDecode<SlackJWTPayload>(jwt);

    // Get custom emojies
    const emojis = await web.emoji.list({ token: accessToken });

    // Get first page of messages with reactions
    let { messages, totalPages } = await getMessages(accessToken, userId, 1);
    
    // Send off a request for the rest of the pages
    const additionalMessagesRequests: AsyncFunction<GetMessagesResult>[] = [];
    console.log(totalPages)
    if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
            additionalMessagesRequests.push(() => getMessages(accessToken, userId, page));
        }
    }
    const pages = await getConcurrentRequests(additionalMessagesRequests, 10); // Batch 10 requests at a time to maximize performance with rate limits
    pages.map(({ messages: additionalMessages }) => {
        messages = messages.concat(additionalMessages);
    });

    console.log(messages.length, ' messages with reactions found.');

    // Get reactions for each message
    const allReactions = await getConcurrentRequests(messages.map(({ channel, timestamp }) => () => getReactions(accessToken, channel, timestamp)), 25); // Batch 25 requests at a time to maximize performance with rate limits
    
    let totalReactions: TotalReactions = {};   
    const reactions = allReactions.flat();
    reactions.forEach(({ name, count }) => {
        let key = name;
        if (name.includes('::')) {
            // Ignore reaction variations like +1::skin-tone-3
            key = name.split('::')[0];
        }

        const currentCount = totalReactions[key];
        if (currentCount) {
            return totalReactions[key] = currentCount + count;
        }
        return totalReactions[key] = count;
    });

    console.log(Object.entries(totalReactions).reduce((sum, [, count]) => sum + count, 0), ' total reactions aggregated.');
    
    const getEmoji = (name: string) => {
        return emoji.get(name) ?? emoji.get(name.replace('-', '_')) ?? emoji.search(name.replace('_', ' '))[0]?.emoji ?? emoji.get(name.split('_')[0]) ?? emoji.search(name)[0]?.emoji ?? name;
    }

    const sortedResponse = Object.entries(totalReactions).sort((a, b) => b[1] - a[1]).map(reaction => ({emoji: getEmoji(reaction[0]), count: reaction[1], emojiUrl: emojis.emoji[reaction[0]]}));
    // console.log(JSON.stringify(sortedResponse));
    return new Response(JSON.stringify(sortedResponse));
}