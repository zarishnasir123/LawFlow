function getCurrentTime() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'AM' : 'PM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutes + ' ' + ampm;
}


function scrollToBottom() {
    const container = document.getElementById('chat-container');
    container.scrollTop = container.scrollHeight;
}


function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}


async function sendMessage() {
    const inputField = document.getElementById('user-input');
    const messageText = inputField.value.trim();
    const chatContainer = document.getElementById('chat-container');
    const suggestionsSection = document.getElementById('suggestions-section');

    if (messageText === "") return;


    if (suggestionsSection) {
        suggestionsSection.style.display = 'none';
        chatContainer.style.paddingBottom = '90px';
    }

    const timeStr = getCurrentTime();


    const userRow = `
        <div class="message-row user">
            <div class="icon-avatar user-icon">S</div>
            <div class="message-content">
                <div class="sender-name">You</div>
                <div class="message-bubble">${messageText}</div>
                <div class="message-time">${timeStr}</div>
            </div>
        </div>
    `;
    chatContainer.innerHTML += userRow;
    inputField.value = "";
    scrollToBottom();

    const typingId = 'typing-' + Date.now();
    const botTypingRow = `
        <div class="message-row bot" id="${typingId}">
            <div class="icon-avatar bot-icon"><i class="fa-regular fa-lightbulb"></i></div>
            <div class="message-content">
                <div class="sender-name">AI Assistant</div>
                <div class="message-bubble" style="color: #777;">LawFlow is typing...</div>
            </div>
        </div>
    `;
    chatContainer.innerHTML += botTypingRow;
    scrollToBottom();

    try {

        const response = await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: messageText })
        });

        const data = await response.json();

        // Typing indicator ko delete karein
        document.getElementById(typingId).remove();

        const botRow = `
            <div class="message-row bot">
                <div class="icon-avatar bot-icon"><i class="fa-regular fa-lightbulb"></i></div>
                <div class="message-content">
                    <div class="sender-name">AI Assistant</div>
                    <div class="message-bubble">${data.reply}</div>
                    <div class="message-time">${getCurrentTime()}</div>
                </div>
            </div>
        `;
        chatContainer.innerHTML += botRow;

    } catch (error) {
        console.error("Backend integration failed:", error);
        document.getElementById(typingId).remove();


        const errorRow = `
            <div class="message-row bot">
                <div class="icon-avatar bot-icon"><i class="fa-regular fa-lightbulb"></i></div>
                <div class="message-content">
                    <div class="sender-name">AI Assistant</div>
                    <div class="message-bubble" style="color: red; border-left-color: red; background-color: #fff5f5;">
                        Error: Connection with LawFlow server lost. Please check if backend is running.
                    </div>
                </div>
            </div>
        `;
        chatContainer.innerHTML += errorRow;
    }

    scrollToBottom();
}


function useSuggestion(text) {
    document.getElementById('user-input').value = text;
    sendMessage();
}