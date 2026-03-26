# FWI Feedback Form

Formulaire de satisfaction premium pour FWI Ambition, avec :

- page web servie par `server.mjs`
- enregistrement local des réponses en `NDJSON`
- envoi email configurable via SMTP

## Lancer en local

```bash
npm install
npm start
```

Le site sera disponible sur `http://localhost:3000`.

## Variables d'environnement

Copiez `.env.example` et renseignez au minimum :

- `FEEDBACK_EMAIL_TO`
- `FEEDBACK_EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`

Si aucun SMTP n'est configuré, le serveur tente un envoi via `sendmail`.

## Mise en ligne sur Render

1. Poussez ce dossier sur GitHub
2. Créez un nouveau service Render depuis le repo
3. Render détectera automatiquement `render.yaml`
4. Renseignez les variables d'environnement SMTP dans l'interface Render
5. Déployez

## Stockage des réponses

Chaque soumission est enregistrée dans :

`data/feedback-submissions.ndjson`

En production, prévoyez ensuite soit :

- un stockage persistant
- une base de données
- ou un export externe type Airtable / Google Sheets / Supabase
