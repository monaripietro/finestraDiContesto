// INSERIRAI QUI L'URL DI VERCEL DOPO IL DEPLOY (es. https://tuo-progetto.vercel.app/api/chat)
const API_URL = "INSERISCI_URL_VERCEL_QUI"; 

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const contextLimitSelect = document.getElementById('context-limit');
const tokenCountSpan = document.getElementById('token-count');
const maxTokensSpan = document.getElementById('max-tokens');
const statusBar = document.getElementById('status-bar');

let messages = [];

// Stima educativa dei token: ~4 caratteri = 1 token
function estimateTokens(text) {
    return Math.max(1, Math.ceil(text.length / 4));
}

// Risolve dinamicamente l'URL dell'API per consentire test locali senza configurazione manuale
function getApiUrl() {
    if (API_URL && API_URL !== "INSERISCI_URL_VERCEL_QUI") {
        return API_URL;
    }
    // Se siamo su localhost o 127.0.0.1, facciamo il fallback automatico all'endpoint relativo
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "[::1]") {
        return "/api/chat";
    }
    return null;
}

function updateUI() {
    const limit = parseInt(contextLimitSelect.value);
    maxTokensSpan.textContent = limit;

    let currentTokens = 0;
    
    // Resetta lo stato (partiamo dal presupposto che siano fuori contesto)
    messages.forEach(m => m.inContext = false);

    // Controlla i messaggi partendo dall'ultimo (il più recente) verso il più vecchio
    for (let i = messages.length - 1; i >= 0; i--) {
        if (currentTokens + messages[i].tokens <= limit) {
            messages[i].inContext = true;
            currentTokens += messages[i].tokens;
        } else {
            break; // Il resto dei messaggi più vecchi rimarrà "inContext = false"
        }
    }

    tokenCountSpan.textContent = currentTokens;

    // Aggiorna lo sfondo in base alla percentuale di riempimento
    const fillPercentage = currentTokens / limit;
    statusBar.className = 'status-bar';
    let bgColor = 'var(--bg-green)';
    
    if (fillPercentage > 1.0) {
        // Fallback di sicurezza (non dovrebbe accadere con il taglio)
        statusBar.classList.add('red');
        bgColor = 'var(--bg-red)';
    } else if (fillPercentage >= 0.8) {
        statusBar.classList.add('red');
        bgColor = 'var(--bg-red)';
    } else if (fillPercentage >= 0.5) {
        statusBar.classList.add('yellow');
        bgColor = 'var(--bg-yellow)';
    } else {
        statusBar.classList.add('green');
    }
    
    chatContainer.style.setProperty('--chat-bg', bgColor);
    renderMessages();
}

function renderMessages() {
    chatContainer.innerHTML = '';
    messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.role} ${msg.inContext ? '' : 'dropped'}`;
        
        const textDiv = document.createElement('div');
        textDiv.textContent = msg.content;
        
        const badge = document.createElement('div');
        badge.className = 'token-badge';
        badge.textContent = `${msg.tokens} token`;

        msgDiv.appendChild(textDiv);
        msgDiv.appendChild(badge);
        chatContainer.appendChild(msgDiv);
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    const activeApiUrl = getApiUrl();

    // Se stiamo testando in locale senza Vercel configurato, e non siamo su localhost, fermati.
    if (!activeApiUrl) {
        alert("Devi prima inserire l'URL di Vercel in app.js!");
        return;
    }

    const userTokens = estimateTokens(text);
    messages.push({ role: 'user', content: text, tokens: userTokens, inContext: true });
    userInput.value = '';
    updateUI();

    // Filtra e invia ALL'API SOLO i messaggi che sono "dentro" la finestra di contesto
    const contextMessages = messages
        .filter(m => m.inContext)
        .map(m => ({ role: m.role, content: m.content }));

    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    try {
        const response = await fetch(activeApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: contextMessages })
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            const botReply = data.choices[0].message.content;
            const botTokens = estimateTokens(botReply);
            messages.push({ role: 'assistant', content: botReply, tokens: botTokens, inContext: true });
        } else {
            console.error("API Error:", data);
            alert("Errore restituito dall'API.");
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Errore di connessione al serverless Vercel.");
    }

    sendBtn.disabled = false;
    sendBtn.textContent = 'Invia';
    updateUI();
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
contextLimitSelect.addEventListener('change', updateUI);
