export default async function handler(req, res) {
    // Configurazione CORS per permettere a GitHub Pages di comunicare con Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Puoi sostituire l'asterisco con l'URL del tuo github.io per maggiore sicurezza
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Risposta rapida per le richieste di preflight (CORS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito. Usa POST.' });
    }

    const { messages } = req.body;

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com', 
                'X-Title': 'Simulatore Contesto Educativo'
            },
            body: JSON.stringify({
                model: 'nvidia/nemotron-nano-9b-v2:free',
                messages: messages
            })
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Errore serverless:", error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
}
