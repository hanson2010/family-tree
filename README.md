# Family Relationship Visualizer

A web app for building and viewing family trees, labelled with Chinese kinship terms. Built with Next.js 16 and D3.js, it stores data in Google Firestore and runs on Google Cloud Run.

## Features

- Sign in with Google. You can change or delete only the persons and relationships you created; private persons are visible only to their creator.
- The tree is built around the selected person and shows 0–3 generations above and below (default 3), one row per generation, with each person's Chinese kinship term relative to the selected person.
- Relationship types: parent–child, sibling, half sibling, spouse, concubine, betrothed, adoptive parent, foster parent, sworn sibling. Birth, death and relationship dates may include month and day.
- A person's marriages are numbered on the tree in order of start date when at least two of them have one.
- Avatars from photos (JPEG, PNG, GIF or WebP, up to 10MB): a photo uploaded for one person is cropped to its middle square. For a group photo, Gemini finds the faces so you can give avatars to several persons, and unused faces can be saved for later.
- Import from text or scans (up to 6 images or PDFs, 20MB in total): Gemini extracts persons and relationships, which you review before saving.
- Duplicate public persons are refused: the same name, or a name matching another's 字 or 号, with birth dates that do not differ. Names such as 王氏 also need the same birth year.
- AI agents can read and change the tree through MCP (see below).

## Run Locally

Requires Node.js 22.22+, a Google Cloud project with a Firestore database in Native mode and a Google OAuth client. A Gemini API key is optional locally.

```bash
npm install
cp .env.local.example .env.local   # fill in the values; each is described in the file
npm run dev                        # http://localhost:3000
```

**Firestore:** create a service account with the Datastore Owner role, download its JSON key and set `GOOGLE_APPLICATION_CREDENTIALS` to that key's path. `GOOGLE_CLOUD_PROJECT` must be the project the key belongs to.

**OAuth:** in Google Cloud Console → APIs & Services → Credentials, create an OAuth client ID of type "Web application". Add the app's URL as an authorized JavaScript origin and `<NEXTAUTH_URL>/auth/callback` as a redirect URI, e.g. `http://localhost:3000` and `http://localhost:3000/auth/callback`.

**Without a Gemini key:** a group photo gives one avatar from the middle of the photo, and importing from text or scans fails. Everything else works. When a Gemini call fails, the app names the cause: credits or billing used up, quota or rate limit, missing or invalid key, Gemini down, or Gemini unreachable.

**Environment variables** already set in your shell or system (e.g. a user-level `GOOGLE_CLOUD_PROJECT`) take precedence over `.env.local`.

**Behind an HTTP proxy:** Google sign-in and Gemini requests ignore `HTTPS_PROXY` unless `NODE_USE_ENV_PROXY=1` is also set; set `NO_PROXY=localhost,127.0.0.1,::1` as well. Firestore uses `HTTPS_PROXY` without it.

## Deploy

On each push to `main`, Cloud Build builds the app and deploys it to Cloud Run using [cloudbuild.yaml](cloudbuild.yaml). One-time setup:

1. Enable the APIs:
   ```bash
   gcloud services enable cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com
   ```
2. Store the four secrets as one JSON secret named `app-secrets`:
   ```bash
   echo -n '{"AUTH_SECRET":"...","GOOGLE_CLIENT_ID":"...","GOOGLE_CLIENT_SECRET":"...","GOOGLE_AI_API_KEY":"..."}' \
     | gcloud secrets create app-secrets --data-file=-
   ```
3. Grant the Cloud Build service account its roles:
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
   CLOUD_BUILD_SA="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:$CLOUD_BUILD_SA" \
     --role="roles/run.admin"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:$CLOUD_BUILD_SA" \
     --role="roles/iam.serviceAccountUser"

   gcloud projects add-iam-policy-binding $PROJECT_ID \
     --member="serviceAccount:$CLOUD_BUILD_SA" \
     --role="roles/secretmanager.secretAccessor"
   ```
4. Connect the GitHub repository and create the trigger (or do this in Cloud Console → Cloud Build → Triggers):
   ```bash
   gcloud builds connections create github family-tree-connection \
     --region=us-west1

   gcloud builds repos create family-tree-repo \
     --connection=family-tree-connection \
     --repo-name=your-github-repo-name \
     --region=us-west1

   gcloud builds triggers create github \
     --name="family-tree-deploy" \
     --region=us-west1 \
     --repo-name=your-github-repo-name \
     --repo-owner=your-github-username \
     --branch-pattern="^main$" \
     --build-config=cloudbuild.yaml
   ```
5. Set `NEXTAUTH_URL` in `cloudbuild.yaml` to the deployed URL:
   ```yaml
   - 'GOOGLE_CLOUD_PROJECT=$PROJECT_ID,NEXTAUTH_URL=https://your-cloud-run-url.a.run.app,GOOGLE_AI_MODEL=gemini-3.5-flash-lite'
   ```
   Then add that URL and its `/auth/callback` redirect URI to the OAuth client.
6. Let Firestore delete expired one-time avatar upload links (usually within 24 hours of expiry):
   ```bash
   gcloud firestore fields ttls update expiresAt --collection-group=AvatarUpload --enable-ttl
   ```

## Usage

- Signed in, the sidebar offers **Add Person**, **Add Relationship**, **Add Family Relationships**, **Import from text or scans** and **Avatars from a group photo**.
- Click a person to select them; double-click one you created to edit them. The right panel shows their details and relatives, and lets you change their relationships, merge another of your persons into them, or delete them with their relationships.
- The gender and "living in year" filters keep the tree connected: persons needed to link the matches are shown faded with a dashed ring.
- The reload button beside **Random person** loads the latest data, e.g. after changes through MCP, and keeps the selected person.
- Point at a person to highlight their lines. Drag to pan, scroll or use +/− to zoom; the third zoom button returns to the full view.
- On screens narrower than 1024px, the header button opens the sidebar and the bar at the bottom opens the details panel.

## AI Agents (MCP)

AI assistants can read and change the family tree through MCP at `<site URL>/api/mcp`, acting as you with the same rules as the website: they see public persons and yours, change only persons and relationships you created, and are refused duplicate public persons.

1. Signed in, open **API tokens** (key icon in the header) and create a token. It is shown once; up to 10 per user. Revoking one stops it at once.
2. Add the server to the client with the token as a Bearer header, e.g. for Claude Code, in your project folder:
   ```bash
   claude mcp add --scope project --transport http family-tree https://family-tree.pythoner.work/api/mcp --header "Authorization: Bearer <token>"
   ```
   This saves the token in the folder's `.mcp.json`; never commit or share that file.

Tools: `search_persons`, `get_person`, `create_person`, `update_person`, `delete_person`, `create_relationship`, `update_relationship`, `delete_relationship`, and for avatars `get_person_avatar`, `set_person_avatar`, `prepare_avatar_upload`, `remove_person_avatar`, `list_saved_faces`, `use_saved_face`.

Avatars (JPEG, PNG, GIF or WebP, up to 10MB) are cropped like an upload in the person form:
- From the web: `set_person_avatar` takes an `https://` address; the server fetches only public addresses.
- From a local file: `prepare_avatar_upload` returns a `curl` command with a one-time upload link (one upload to that person, valid for 10 minutes, no API token in it); the agent runs it with the file path filled in.

## Open Items

| Item | Status |
|------|--------|
| Families (`Family` entity, `/api/families`) | Not built |
| Export | Not built |
| Avatars uploaded before face cropping | Stored as the original photos |
| Relationship-type and branch filters | Not built |
| Relationship dialogs: layout redesign and remaining hard-coded Chinese texts | Not done |
| Dark theme | Tokens exist; no toggle |
| Zustand store (`src/store/index.ts`) | Unused; state lives in the page |

## License

MIT. See [LICENSE](LICENSE).
