# Family Relationship Visualizer

A sophisticated web application for modeling, visualizing, and interacting with complex family relationship structures. Built with Next.js 15, D3.js, and Google Cloud Platform.

## Features

- **GitHub Authentication** - Secure login via GitHub OAuth 2.0
- **Privacy Controls** - Mark persons as private (visible only to creator)
- **Relative Generation** - Generation numbers computed relative to selected person
- **Centered Visualization** - Selected person displayed at center with configurable generations above and below
- **Gender-Specific Colors** - Blue gradient for males, Yellow/Gold gradient for females
- **Precise Dates** - Optional month and day for birth/death and relationship dates
- **Avatar Support** - Upload and display avatar images for each person
- **Gemini Image Processing** - AI-powered smart cropping and compression for avatars
- **Google Datastore** - Native Datastore for scalable, serverless data storage
- **Cloud Run Deployment** - Containerized deployment on Google Cloud Run

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **Authentication**: NextAuth.js v5 with GitHub OAuth
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
- GitHub OAuth App credentials
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
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` - From GitHub OAuth App settings
   - `GOOGLE_CLOUD_PROJECT` - Your GCP project ID
   - `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account JSON
   - `GOOGLE_AI_API_KEY` - From Google AI Studio

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

### GitHub OAuth Setup

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App:
   - Application name: Family Tree Visualizer
   - Homepage URL: `http://localhost:3000` (development)
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Copy Client ID and generate Client Secret

## Project Structure

```
family-tree/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth.js handlers
│   │   │   ├── avatar/        # Avatar upload with Gemini
│   │   │   ├── persons/       # Person CRUD
│   │   │   ├── relationships/ # Relationship CRUD
│   │   │   └── seed/          # Sample data seeding
│   │   ├── globals.css        # Global styles
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Main page
│   │   └── providers.tsx      # Context providers
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── FamilyTreeCanvas.tsx
│   │   ├── FilterControls.tsx
│   │   ├── Header.tsx
│   │   ├── PersonForm.tsx
│   │   ├── RelationshipForm.tsx
│   │   └── Sidebar.tsx
│   ├── lib/                  # Utility libraries
│   │   ├── auth.ts          # NextAuth configuration
│   │   ├── datastore.ts     # Datastore client
│   │   ├── generation-calculator.ts
│   │   └── utils.ts         # Utility functions
│   ├── store/               # Zustand store
│   └── types/               # TypeScript types
├── Dockerfile               # Docker configuration
├── next.config.mjs         # Next.js configuration
├── tailwind.config.ts      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

## Deployment

### Cloud Run Deployment

1. Build and push Docker image:
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/family-tree
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy family-tree \
  --image gcr.io/PROJECT_ID/family-tree \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEXTAUTH_URL=https://YOUR_DOMAIN,GOOGLE_CLOUD_PROJECT=PROJECT_ID \
  --set-secrets NEXTAUTH_SECRET=nextauth-secret:latest,\
GITHUB_CLIENT_ID=github-client-id:latest,\
GITHUB_CLIENT_SECRET=github-client-secret:latest,\
GOOGLE_AI_API_KEY=google-ai-api-key:latest
```

3. Create secrets in Secret Manager:
```bash
echo -n "your-nextauth-secret" | gcloud secrets create nextauth-secret --data-file=-
echo -n "your-github-client-id" | gcloud secrets create github-client-id --data-file=-
echo -n "your-github-client-secret" | gcloud secrets create github-client-secret --data-file=-
echo -n "your-gemini-api-key" | gcloud secrets create google-ai-api-key --data-file=-
```

### Cloud Build CI/CD (Automatic Deployment from GitHub)

1. **Enable required APIs:**
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

2. **Grant Cloud Build permissions:**
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

3. **Create a repository connection (GitHub):**
```bash
# Create connection
gcloud builds connections create github family-tree-connection \
  --region=us-central1

# Link your GitHub repository
gcloud builds repos create family-tree-repo \
  --connection=family-tree-connection \
  --repo-name=your-github-repo-name \
  --region=us-central1
```

4. **Create a build trigger:**
```bash
gcloud builds triggers create github \
  --name="family-tree-deploy" \
  --region=us-central1 \
  --repo-name=your-github-repo-name \
  --repo-owner=your-github-username \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

5. **Or configure via Cloud Console:**
   - Go to **Cloud Build** → **Triggers** → **Create Trigger**
   - Select your GitHub repository
   - Set branch pattern (e.g., `^main$`)
   - Select **Cloud Build configuration file** → `cloudbuild.yaml`
   - Click **Create**

6. **Update NEXTAUTH_URL in cloudbuild.yaml:**
   After first deployment, update the URL in `cloudbuild.yaml`:
   ```yaml
   --set-env-vars
   - 'NEXTAUTH_URL=https://your-actual-cloud-run-url.a.run.app,GOOGLE_CLOUD_PROJECT=$PROJECT_ID'
   ```

## Usage

### Adding Family Members

1. Sign in with GitHub
2. Click "Add Person" in the sidebar
3. Fill in the person details:
   - Name (required)
   - Gender (required)
   - Birth/Death dates (optional)
   - Avatar (optional)
   - Privacy setting
4. Click Save

### Creating Relationships

1. Sign in with GitHub
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
- **Double-click** to edit a person
- **Drag** nodes to reposition
- **Scroll** to zoom
- **Click and drag** background to pan

## License

MIT License - see [LICENSE](LICENSE) file for details.
