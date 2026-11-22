# Family Relationship Visualizer

A web app for building and viewing family trees, labelled with Chinese kinship terms. Built with Next.js 16 and D3.js, it stores data in Google Firestore and runs on Google Cloud Run.

## Features

- Sign in with Google. Only a person's creator can edit or delete them.
- Mark a person as private: visible only to their creator.
- No duplicate public persons: adding, editing, merging or importing a public person is refused when it matches a public person or one of your own, meaning the name equals the other's name, 字 or 号 (alone or after the surname), and the birth dates do not differ. A missing birth year counts as matching, except for names that are only a surname and 氏 (王氏), which need the same known year. Private persons are not checked.
- The tree is built around the selected person and shows 0–3 generations above and below, with generation numbers relative to that person.
- Each generation is one row. A husband sits left of his partners (wife, then concubine, then betrothed), or right of them if that makes fewer parent–child lines cross; siblings run oldest to youngest, those without a birth year last; children sit under their parents.
- Each person shows their Chinese kinship term relative to the selected person.
- Marriage order: when a person has at least two marriages (spouse or concubine) with a start date, each of those lines shows a number (1, 2, …) near that person, in order of start date. Set the start date when adding or changing a relationship.
- Relationship types: parent–child, sibling, half sibling, spouse, concubine, betrothed, adoptive parent, foster parent, sworn sibling.
- Birth, death and relationship dates can include month and day (both optional).
- One avatar per person, from a JPEG, PNG, GIF or WebP photo up to 10MB. Gemini finds the faces and each becomes a 256×256 JPEG; with several faces you choose one. Without a face found, the middle of the photo is used.
- Avatars from a group photo: choose who each face is, from the persons you created in the current family tree (everyone connected to the selected person). Unused faces can be saved (up to 500 per user, visible only to you); the person form lists them to use for any person, including ones created later. A saved face is removed once used, or with its delete button. The photo itself is not stored.
- In **Add Relationship** and **Add Family Relationships**, search covers name, courtesy name and art name. Suggestions list plausible persons first (gender, and a birth year fitting the other persons chosen: parent 15–60 years older than the child, mother 15–50, spouse within 20 years, concubine within 30), then persons without any relationship before others.
- Import from text or scans: paste records such as a genealogy, or upload up to 6 page images or PDFs (each up to 10MB, 20MB in total). Gemini extracts persons and relationships; you review them before saving. A found person is linked by default to the one person in the tree with the same name, or else whose name, 字 or 号 (alone or after the surname, e.g. 蒋介石 for 蒋中正 字 介石) matches; birth years must not differ. The import is saved in one go, applies the same duplicate check as **Add Person**, and skips relationships that already exist.

## Run Locally

Requires Node.js 22.22+, a Google Cloud project with a Firestore database in Native mode and a Google OAuth client. A Gemini API key is optional locally.

```bash
npm install
cp .env.local.example .env.local   # fill in the values; each is described in the file
npm run dev                        # http://localhost:3000
```

**Firestore:** create a service account with the Datastore Owner role, download its JSON key and set `GOOGLE_APPLICATION_CREDENTIALS` to that key's path. `GOOGLE_CLOUD_PROJECT` must be the project the key belongs to.

**OAuth:** in Google Cloud Console → APIs & Services → Credentials, create an OAuth client ID of type "Web application". Add the app's URL as an authorized JavaScript origin and `<NEXTAUTH_URL>/auth/callback` as a redirect URI, e.g. `http://localhost:3000` and `http://localhost:3000/auth/callback`.

**Without a Gemini key:** an uploaded avatar is the middle of the photo, a group photo gives that one avatar, and importing from text or scans fails. Everything else works. When a Gemini call fails, the app names the cause: credits or billing used up, quota or rate limit, missing or invalid key, Gemini down, or Gemini unreachable.

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

## Usage

- Sign in, then use **Add Person**, **Add Relationship**, **Import from text or scans** or **Avatars from a group photo** in the sidebar.
- Click a person to select them. The view shows the whole tree, zoomed out no further than 9px text, and moves the selected person as close to the centre as the tree's edges allow; a tree too large at that size is shown in part. Double-click a person you created to edit them.
- The gender and "living in year" filters keep the tree connected: matching persons are shown with the persons needed to connect them to the selected person, drawn grey and faded with a dashed ring. The selected person always stays. A person with no birth or death year matches the "living in year" filter.
- **Merge with another person** (right panel, persons you created): choose a second person of your own and, for each detail that differs, which value to keep. Their relationships move to the selected person, duplicates and relationships between the two are deleted, and the second person is deleted, all in one step.
- Lines: a child of a couple has one curve, from the middle of the couple's marriage line, or from the mother when someone sits between the couple; otherwise one curve from each parent. Marriage arches over other persons rise higher the more persons they pass. Point at a person to fade every line but theirs.
- Drag the background to pan.
- Scroll or use +/− to zoom. The third zoom button returns to the view described above.
- On screens narrower than 1024px, the header button opens the search/actions panel and the bar at the bottom opens the details panel.
- The browser remembers the last selected person.

## Open Items

| Item | Status |
|------|--------|
| Families (`Family` entity, `/api/families`) | Not built |
| Export | Not built |
| Avatars uploaded before face cropping | Stored as the original photos |
| Relationship-type and branch filters | Not built |
| Relationship list for signed-in users includes relationships of other users' private persons | Open privacy gap; the API should filter them like persons |
| Deleting a person leaves their relationships | Open; should delete or block |
| Relationship dialogs: layout redesign and remaining hard-coded Chinese texts | Not done |
| Dark theme | Tokens exist; no toggle |
| Zustand store (`src/store/index.ts`) | Unused; state lives in the page |

## License

MIT. See [LICENSE](LICENSE).
