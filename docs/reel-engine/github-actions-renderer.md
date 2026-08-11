# GitHub Actions Reel Renderer

This renderer uses GitHub Actions as an on-demand ffmpeg worker.

Flow:

1. Source video is stored in Cloudflare R2.
2. `Render Reel` workflow is triggered manually.
3. GitHub Actions downloads the source video from R2.
4. ffmpeg converts it to 1080x1920 and burns telop text into the video.
5. The rendered MP4 is uploaded back to R2.
6. Raven SNS Engine can publish the rendered MP4 as an Instagram Reel.

Required GitHub repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The token needs permission to read and write R2 objects for the Raven account.

Manual workflow inputs:

- `input_key`: existing R2 object key, for example `reel-assets/raven-oracle/source.mp4`
- `output_key`: target R2 object key, for example `reel-renders/raven-oracle/rendered.mp4`
- `title`: main telop
- `subtitle`: second telop
- `brand`: footer text, default `Raven Blackwood`

Current limitation:

The workflow renders and uploads the MP4. Registering the rendered asset in D1 and publishing it to Instagram remain controlled by the Raven admin/API flow.
