const { WebClient, ErrorCode, LogLevel } = require('@slack/web-api');
import { jwtDecode } from "jwt-decode";
import getConcurrentRequests from "../../utils/getConcurrentRequests";


const appToken = process.env.SLACK_TOKEN;
const clientSecret = process.env.CLIENT_SECRET;
const web = new WebClient(appToken, {
    loglLevel: LogLevel.DEBUG
});

const getMessages = async (token, userId, page) => {
    const messagesWithReactions = await web.search.messages({
        token,
        query: `from:${userId} has:reaction`,
        count: 100,
        page
    });

    const messages = messagesWithReactions.messages.matches.map(match => ({
        channel: match.channel.id,
        timestamp: match.ts
    }));

    return { messages, totalPages: messagesWithReactions.messages.paging.pages };
};

const getReactions = async (token, channel, timestamp) => {
    try {
        const reactions = await web.reactions.get({
            token,
            channel,
            timestamp
        })

        return reactions.message.reactions;
    } catch (error) {
        console.log('Reaction ERROR: ', error);
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
    const {"https://slack.com/user_id": userId } = jwtDecode(jwt);

    // Get custom emojies
    const emojis = await web.emoji.list({token: accessToken});
    console.log(emojis);

    const startTime = Date.now();
    console.log("// Start: ", startTime);

    // Get first page of messages with reactions
    let { messages, totalPages } = await getMessages(accessToken, userId, 1);
    
    // Send off a request for the rest of the pages
    const additionalMessagesRequests:Function[] = [];
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
    let totalReactions = {};   
    const reactions = allReactions.flat();
    reactions.forEach(({ name, count }) => {
        const currentCount = totalReactions[name];
        if (currentCount) {
            return totalReactions[name] = currentCount + count;
        }
        return totalReactions[name] = count;
    });

    console.log("// Reactions: ", Date.now() - startTime);

    return new Response(JSON.stringify({ reactionCount: totalReactions, emojis }));
}