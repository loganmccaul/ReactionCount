# Reaction Count

A small web tool that scans your Slack messages for reactions and aggregates emoji counts so you can see how your team responds to your messages.

Features
- Exchange an OAuth code with Slack and fetch the user's access token
- Search messages that have reactions and fetch reactions for each message
- Aggregate and sort reaction counts (including custom emoji URLs)
- Client-side bar chart visualization and copy-to-share output

Quick start (development)
1. Copy or clone the repository
2. Install dependencies

```bash
npm install
```

3. Create a `.env` file with the following variables (example):

```
SLACK_TOKEN=<bot-or-app-token>
CLIENT_ID=<slack-client-id>
CLIENT_SECRET=<slack-client-secret>
```

4. Run the app (depends on environment — for Vercel, deploy as a serverless function; for local testing use a simple static server):

```bash
# serve static files from the project root
npx serve .
```

How it works
- The frontend triggers an OAuth flow to obtain an authorization code
- The backend endpoint at `api/reaction-count/[exchange].ts` exchanges the code for an access token, retrieves messages with reactions, fetches reactions per message, aggregates counts, and returns a JSON array of { emoji, count, emojiUrl }
- The frontend renders the bar chart from the JSON response

Environment and security
- This project requires Slack OAuth credentials and a Slack token with scopes to search messages and read reactions
- Do not check credentials into source control. Use environment variables or a secrets store in your deploy platform.

Notes & next steps
- Add a loading state and better error handling UI (frontend)
- Improve pagination and rate-limit handling (backend)
- Add tests and CI

License
MIT
