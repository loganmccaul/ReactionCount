# Reaction Count

A small web tool that scans your Slack messages for reactions and aggregates emoji counts so you can see how your team responds to your messages.

## Self Deploy
If you are concerned about installing an external app into your workspace you can create an internal app in your workspace in a few steps.

### Clone this repo
1. Clone this repo so can update the environment variables

### Create a free Vercel app
1. Sign up or sign into Vercel, https://vercel.com
2. Select "Add new" and then "Project"
3. Connect the project to your cloned Github repo

### Creating a Slack App
1. Navigate to https://api.slack.com/apps
2. Select "Create New App"
3. Select "From a manifest"
4. Select your workspace
5. Copy this manifest, and update the `redirect_url` with the URL generated for your Vercel project:
```JSON
{
    "display_information": {
        "name": "Reaction Count",
        "description": "Counts number of reactions a user has across all messages",
        "background_color": "#3459c7",
        "long_description": "Reaction Count enables Slack users to retrieve all the reactions they've received on all of their messages, counting them to provide a view of how other Slack users respond to their messages."
    },
    "oauth_config": {
        "redirect_urls": [
            "" // INSERT Vercel URL here
        ],
        "scopes": {
            "user": [
                "emoji:read",
                "reactions:read",
                "search:read"
            ]
        }
    },
    "settings": {
        "org_deploy_enabled": true,
        "socket_mode_enabled": false,
        "token_rotation_enabled": false
    }
}
```

### Update variables
1. In your Vercel project, navigate to "Settings" and then "Environment Variables"
2. Add the Client ID from your Slack app as a `CLIENT_ID` variable
3. Add the Client Secret from your Slack app as a `CLIENT_SECRET` variable

1. Open your cloned repo in your code editor of choice
2. Update the `href` on the Log in to Slack button to include your Vercel redirect URL and your Slack app's client ID
```
https://slack.com/oauth/v2/authorize?user_scope=emoji:read,reactions:read,search:read&amp;response_type=code&amp;redirect_uri=INSERT REDIRECT URL&amp;client_id=INSERT SLACK CLIENT ID
```
3. Commit and push and your app should autodeploy with Vercel.
  
You should now be up and running.




License
MIT
