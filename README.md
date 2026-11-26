# PrepPilot

PrepPilot helps students and job seekers prepare for interviews using their resume and a target role or job description. It includes a resume match, ATS-style checklist, interview question sets, a mock-answer coach, and a 7-day preparation plan.

## Run locally

```powershell
npm install
npm start
```

Open <http://localhost:3000>. Without an AI key the app uses its built-in offline engine. For AI-generated job preparation and answer feedback, copy `.env.example` to `.env` and set `OPENAI_API_KEY`. Never commit `.env` or publish an API key.

## Deployment

The app has a Node.js API and a static frontend. GitHub Pages cannot run the Node API, but the frontend includes an offline resume parser and preparation engine, so core resume analysis, ATS checks, and mock-answer feedback work in the browser without the API. AI-generated results require the optional Node API and an API key. This repository includes:

- A GitHub Actions workflow to publish `public/` to GitHub Pages on pushes to `main`.
- A Render Blueprint (`render.yaml`) to host the Node API.

### Deploy the API on Render

1. Sign in to Render and create a new Blueprint from this repository.
2. Deploy the `preppilot-api` web service. Render will use `render.yaml`.
3. In the Render service's environment settings, add `OPENAI_API_KEY` if you want AI-generated results. Leave it unset to use offline mode.
4. Confirm the service health check responds at `/api/status`.
5. Set `window.PREP_API_BASE` in `public/config.js` to the deployed API URL and push the change to enable server and AI mode. Leave it empty to keep GitHub Pages in browser-only offline mode.

The Render service allows browser requests from `https://rachana2522.github.io`. If the GitHub Pages owner or API URL changes, update `ALLOWED_ORIGINS` in Render and `public/config.js`.

### Deploy the frontend on GitHub Pages

1. In the repository settings, open **Pages** and set the source to **GitHub Actions**.
2. Push to `main` or run **Deploy PrepPilot to GitHub Pages** manually from the Actions tab.
3. The site will be available at `https://rachana2522.github.io/preppilot/`.

The Pages workflow publishes only the static frontend; it does not expose API secrets. When using the offline engine, resume files are processed in the browser and are not uploaded. Recent preps and checked-off topics are stored in the user's browser local storage.

## Supported resume formats

PDF, DOCX and TXT (maximum upload size: 5 MB).
