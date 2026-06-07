// Percorso relativo per Vercel
const API_URL = "/api/chat"; 

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const contextLimitSelect = document.getElementById('context-limit');

let messages = [];

// Stima token: circa 4 caratteri per token
function estimateTokens(text) {
    return Math.max(1, Math.ceil(text.length / 4));
}

// Ricalcola quali messaggi sono "dentro" o "fuori" dal contesto
function updateUI() {
    const limit = parseInt(contextLimitSelect.value);
    let currentTokens = 0;
    
    messages.forEach(m => m.inContext = false);

    // Controlla a ritroso: aggiunge messaggi finché c'è spazio
    for (let i = messages.length - 1; i >= 0; i--) {
        if (currentTokens + messages[i].tokens <= limit) {
            messages[i].inContext = true;
            currentTokens += messages[i].tokens;
        } else {
            break; 
        }
    }

    renderMessages(currentTokens, limit);
}

// Crea l'elemento HTML per il singolo messaggio
function createMessageElement(msg, inContext) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${msg.role} ${inContext ? '' : 'dropped'}`;
    
    const textDiv = document.createElement('div');
    
    // Converte il Markdown in HTML solo per le risposte dell'IA
    if (msg.role === 'assistant') {
        textDiv.innerHTML = marked.parse(msg.content);
    } else {
        textDiv.textContent = msg.content;
    }
    
    const badge = document.createElement('div');
    badge.className = 'token-badge';
    badge.textContent = `${msg.tokens} token`;

    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(badge);
    return msgDiv;
}

// Disegna l'intera chat
function renderMessages(currentTokens, limit) {
    chatContainer.innerHTML = '';
    
    const droppedMessages = messages.filter(m => !m.inContext);
    const activeMessages = messages.filter(m => m.inContext);

    // 1. Stampa i messaggi dimenticati in alto (opachi)
    if (droppedMessages.length > 0) {
        const droppedHeader = document.createElement('div');
        droppedHeader.className = 'dropped-header';
        droppedHeader.textContent = '↑ Dimenticati dall\'IA (fuori contesto) ↑';
        chatContainer.appendChild(droppedHeader);

        droppedMessages.forEach(msg => {
            chatContainer.appendChild(createMessageElement(msg, false));
        });
    }

    // 2. Stampa il box della finestra di contesto con i messaggi attivi
    if (activeMessages.length > 0) {
        const windowBox = document.createElement('div');
        
        const fillPercentage = currentTokens / limit;
        let colorClass = 'green';
        if (fillPercentage >= 0.8) colorClass = 'red';
        else if (fillPercentage >= 0.5) colorClass = 'yellow';
        
        windowBox.className = `context-window-box ${colorClass}`;
        
        // Header del box e barra di progresso
        const windowHeader = document.createElement('div');
        windowHeader.className = 'context-window-header';
        
        const headerText = document.createElement('div');
        headerText.className = 'header-text';
        headerText.innerHTML = `⬇ FINESTRA DI CONTESTO ATTIVA (${currentTokens} / ${limit} TOKEN) ⬇`;
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        
        const progressBar = document.createElement('div');
        progressBar.className = `progress-bar ${colorClass}`;
        progressBar.style.width = `${Math.min(100, fillPercentage * 100)}%`;
        
        progressContainer.appendChild(progressBar);
        windowHeader.appendChild(headerText);
        windowHeader.appendChild(progressContainer);
        windowBox.appendChild(windowHeader);

        activeMessages.forEach(msg => {
            windowBox.appendChild(createMessageElement(msg, true));
        });

        chatContainer.appendChild(windowBox);
    }
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Invia il messaggio al backend Serverless
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Se l'app è aperta via protocollo file:// (es. doppio click su index.html)
    if (window.location.protocol === 'file:') {
        alert("L'applicazione deve essere eseguita tramite un server web (es. con Live Server o vercel dev) per poter effettuare chiamate API relative.");
        return;
    }

    const userTokens = estimateTokens(text);
    messages.push({ role: 'user', content: text, tokens: userTokens, inContext: true });
    userInput.value = '';
    updateUI();

    // Estrae e invia SOLO i messaggi che si trovano all'interno del contesto
    const contextMessages = messages
        .filter(m => m.inContext)
        .map(m => ({ role: m.role, content: m.content }));

    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: contextMessages })
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            const botReply = data.choices[0].message.content;
            const botTokens = estimateTokens(botReply);
            messages.push({ role: 'assistant', content: botReply, tokens: botTokens, inContext: true });
        }
    } catch (error) {
        console.error("Network Error:", error);
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
