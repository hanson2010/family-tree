# Family Relationship Visualizer

A sophisticated web application for modeling, visualizing, and interacting with complex family relationship structures. Built with Next.js 15, D3.js, and Google Cloud Platform.

## Features

- **Google Authentication** - Sign in with a Google account (OAuth 2.0)
- **Privacy Controls** - Mark persons as private (visible only to creator)
- **Relative Generation** - Generation numbers computed relative to selected person
- **Centered Visualization** - Selected person displayed at center with 0–3 generations above and below
- **Kinship Terms** - Each person in the tree is labelled with their Chinese kinship term relative to the selected person
- **Gender-Specific Colors** - Blue gradient for males, Yellow/Gold gradient for females
- **Precise Dates** - Optional month and day for birth/death and relationship dates
- **Avatar Support** - Upload and display avatar images for each person
- **Gemini Image Processing** - AI-powered smart cropping and compression for avatars
- **Google Datastore** - Native Datastore for scalable, serverless data storage
- **Cloud Run Deployment** - Containerized deployment on Google Cloud Run

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **Authentication**: NextAuth.js v5 with Google OAuth
- **UI Components**: shadcn/ui + Radix UI + Tailwind CSS
- **Visualization**: D3.js v7 (force-directed graphs)
- **State Management**: Zustand
- **Database**: Google Datastore (Native Mode)
- **AI**: Google Gemini (avatar processing)
- **Deployment**: Docker + Google Cloud Run

## Getting Started

### Prerequisites

- Node.js 20+
- Google Cloud account with Datastore enabled
- Google OAuth client credentials
- Google AI (Gemini) API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd family-tree
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.local.example .env.local
```

4. Configure environment variables in `.env.local`:
   - `AUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - From the Google OAuth client
   - `GOOGLE_CLOUD_PROJECT` - Your GCP project ID
   - `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON
   - `GOOGLE_AI_API_KEY` - From Google AI Studio
   - `GOOGLE_AI_MODEL` - Gemini model name (e.g. `gemini-3.5-flash-lite`)

   Alternatively, you can set a single `APP_SECRETS` JSON variable instead of individual secrets:
   ```
   APP_SECRETS={"AUTH_SECRET":"...","GOOGLE_CLIENT_ID":"...","GOOGLE_CLIENT_SECRET":"...","GOOGLE_AI_API_KEY":"..."}
   ```
   If `APP_SECRETS` is set, the individual variables above are ignored; its keys use the same names.

5. Run development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

### Google Cloud Setup

1. Create a new Google Cloud project
2. Enable Datastore API
3. Create a service account with Datastore Owner role
4. Download service account JSON key
5. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### Google OAuth Setup

1. In Google Cloud Console, go to APIs & Services > Credentials (configure the OAuth consent screen first if asked)
2. Create an OAuth client ID of type "Web application":
   - Authorized JavaScript origins: `http://localhost:3000` (development)
   - Authorized redirect URIs: `http://localhost:3000/auth/callback`
3. Copy the Client ID and Client Secret

For production, add the deployed URL as an origin and `<deployed URL>/auth/callback` as a redirect URI.

The redirect URI sent to Google is `NEXTAUTH_URL` + `/auth/callback`, so `NEXTAUTH_URL` must be the URL the app is served from.

A user's id is their Google account id. Persons and relationships can only be edited by the user whose id is in their `createdBy` field.

## Deployment

Deployment is handled automatically via Cloud Build CI/CD on push to `main`.

### Initial Setup

1. **Enable required APIs:**
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

2. **Create the combined secret in Secret Manager:**
```bash
echo -n '{"AUTH_SECRET":"your-auth-secret","GOOGLE_CLIENT_ID":"your-google-client-id","GOOGLE_CLIENT_SECRET":"your-google-client-secret","GOOGLE_AI_API_KEY":"your-gemini-api-key"}' | gcloud secrets create app-secrets --data-file=-
```

3. **Grant Cloud Build permissions:**
```bash
# Get Cloud Build service account
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CLOUD_BUILD_SA="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUD_BUILD_SA" \
  --role="roles/run.admin"

# Grant IAM Service Account User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUD_BUILD_SA" \
  --role="roles/iam.serviceAccountUser"

# Grant Secret Manager Secret Accessor role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$CLOUD_BUILD_SA" \
  --role="roles/secretmanager.secretAccessor"
```

4. **Create a repository connection (GitHub):**
```bash
# Create connection
gcloud builds connections create github family-tree-connection \
  --region=us-west1

# Link your GitHub repository
gcloud builds repos create family-tree-repo \
  --connection=family-tree-connection \
  --repo-name=your-github-repo-name \
  --region=us-west1
```

5. **Create a build trigger:**
```bash
gcloud builds triggers create github \
  --name="family-tree-deploy" \
  --region=us-west1 \
  --repo-name=your-github-repo-name \
  --repo-owner=your-github-username \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

Or configure via Cloud Console:
- Go to **Cloud Build** → **Triggers** → **Create Trigger**
- Select your GitHub repository
- Set branch pattern (e.g., `^main$`)
- Select **Cloud Build configuration file** → `cloudbuild.yaml`
- Click **Create**

6. **Update NEXTAUTH_URL in cloudbuild.yaml:**
   After first deployment, update the URL in `cloudbuild.yaml`:
   ```yaml
   --set-env-vars
   - 'NEXTAUTH_URL=https://your-actual-cloud-run-url.a.run.app,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_AI_MODEL=gemini-3.5-flash-lite'
   ```

## Usage

### Adding Family Members

1. Sign in with Google
2. Click "Add Person" in the sidebar
3. Fill in the person details:
   - Name (required)
   - Gender (required)
   - Birth/Death dates (optional)
   - Avatar (optional)
   - Privacy setting
4. Click Save

### Creating Relationships

1. Sign in with Google
2. Click "Add Relationship" in the sidebar
3. Select Person A and Person B
4. Choose relationship type:
   - Parent - Child
   - Sibling
   - Half Sibling
   - Spouse
   - Concubine
   - Betrothed
   - Adoptive Parent
   - Foster Parent
   - Sworn Sibling
5. Add dates if applicable
6. Click Save

### Navigation

- **Click** on a person to select them as the center
- **Double-click** a person you created to edit them
- **Drag** nodes to reposition
- **Scroll** or use the +/− buttons to zoom; the third button fits the whole tree in view
- **Click and drag** background to pan
- On screens narrower than 1024px, the search/actions panel opens from the header button and the details panel from the bar at the bottom

Only the creator of a person can edit or delete them. The last selected person is remembered in the browser.

## License

MIT License - see [LICENSE](LICENSE) file for details.
