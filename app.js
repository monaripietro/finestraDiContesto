// Percorso relativo per Vercel
const API_URL = "/api/chat"; 

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const contextLimitSelect = document.getElementById('context-limit');

let messages = [];

function estimateTokens(text) {
    return Math.max(1, Math.ceil(text.length / 4));
}

function updateUI() {
    const limit = parseInt(contextLimitSelect.value);
    let currentTokens = 0;
    
    // Resetta lo stato di tutti i messaggi
    messages.forEach(m => m.inContext = false);

    // Controlla i messaggi partendo dal più recente al più vecchio
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

function createMessageElement(msg, inContext) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${msg.role} ${inContext ? '' : 'dropped'}`;
    
    const textDiv = document.createElement('div');
    textDiv.textContent = msg.content;
    
    const badge = document.createElement('div');
    badge.className = 'token-badge';
    badge.textContent = `${msg.tokens} token`;

    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(badge);
    return msgDiv;
}

function renderMessages(currentTokens, limit) {
    chatContainer.innerHTML = '';
    
    // Separiamo i messaggi attivi da quelli fuori contesto
    const droppedMessages = messages.filter(m => !m.inContext);
    const activeMessages = messages.filter(m => m.inContext);

    // 1. Renderizza i messaggi usciti dalla finestra (in alto)
    if (droppedMessages.length > 0) {
        const droppedHeader = document.createElement('div');
        droppedHeader.className = 'dropped-header';
        droppedHeader.textContent = '↑ Questa parte è uscita dalla finestra di contesto ↑';
        chatContainer.appendChild(droppedHeader);

        droppedMessages.forEach(msg => {
            chatContainer.appendChild(createMessageElement(msg, false));
        });
    }

    // 2. Crea il BOX VISIVO della Finestra di Contesto
    if (activeMessages.length > 0) {
        const windowBox = document.createElement('div');
        
        // Calcola il colore in base al riempimento
        const fillPercentage = currentTokens / limit;
        let colorClass = 'green';
        if (fillPercentage >= 0.8) colorClass = 'red';
        else if (fillPercentage >= 0.5) colorClass = 'yellow';
        
        windowBox.className = `context-window-box ${colorClass}`;
        
        // Intestazione del box che scende
        const windowHeader = document.createElement('div');
        windowHeader.className = 'context-window-header';
        windowHeader.innerHTML = `⬇ FINESTRA DI CONTESTO (${currentTokens} / ${limit} TOKEN) ⬇`;
        windowBox.appendChild(windowHeader);

        // Inserisci i messaggi attivi DENTRO il box
        activeMessages.forEach(msg => {
            windowBox.appendChild(createMessageElement(msg, true));
        });

        chatContainer.appendChild(windowBox);
    }
    
    // Auto-scroll verso il basso
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

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
        } else {
            console.error("API Error:", data);
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
