const API_KEY = 'AIzaSyDGdRop5G44CoLOYhD-mh2bR7eJqnt1JzQ';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-exp-03-25:generateContent';

const appRequestInput = document.getElementById('app-request');
const generateBtn = document.getElementById('generate-btn');
const appContainer = document.getElementById('app-container');
const appResult = document.getElementById('app-result');
const suggestionsContainer = document.getElementById('suggestions');
const appLibrary = document.getElementById('app-library');
const existingAppDialog = document.getElementById('existing-app-dialog');
const useExistingBtn = document.getElementById('use-existing-btn');
const createNewBtn = document.getElementById('create-new-btn');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

let currentRequest = '';
let similarAppFound = null;

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        if (tabId === 'library') {
            loadAppLibrary();
        }
    });
});

appRequestInput.addEventListener('input', () => {
    const query = appRequestInput.value.trim().toLowerCase();
    
    if (query.length < 3) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    const savedApps = getSavedApps();
    const filteredApps = savedApps.filter(app => 
        app.title.toLowerCase().includes(query) || 
        app.description.toLowerCase().includes(query)
    );
    
    if (filteredApps.length > 0) {
        suggestionsContainer.innerHTML = '';
        filteredApps.forEach(app => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = app.title;
            item.addEventListener('click', () => {
                loadApp(app);
                appRequestInput.value = app.title;
                suggestionsContainer.style.display = 'none';
            });
            suggestionsContainer.appendChild(item);
        });
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.style.display = 'none';
    }
});

document.addEventListener('click', (event) => {
    if (!suggestionsContainer.contains(event.target) && event.target !== appRequestInput) {
        suggestionsContainer.style.display = 'none';
    }
});

generateBtn.addEventListener('click', async () => {
    const request = appRequestInput.value.trim();
    if (!request) return;
    
    currentRequest = request;

    const savedApps = getSavedApps();
    similarAppFound = savedApps.find(app => 
        app.title.toLowerCase() === request.toLowerCase() ||
        similarity(app.title.toLowerCase(), request.toLowerCase()) > 0.8
    );
    
    if (similarAppFound) {
        existingAppDialog.style.display = 'flex';
        return;
    }
    
    await generateApp(request);
});

useExistingBtn.addEventListener('click', () => {
    existingAppDialog.style.display = 'none';
    if (similarAppFound) {
        loadApp(similarAppFound);
    }
});

createNewBtn.addEventListener('click', async () => {
    existingAppDialog.style.display = 'none';
    await generateApp(currentRequest);
});
function cleanMarkdownCode(code) {
    let cleanedCode = code.replace(/^```(html|javascript|js|css)?\s*/i, '');
    cleanedCode = cleanedCode.replace(/```\s*$/i, '');

    cleanedCode = cleanedCode.replace(/^\s*```\s*$/gm, '');
    
    return cleanedCode;
}

async function generateApp(request) {
    appContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;

    try {
        const prompt = `
            Create a web application at the following user request: "${request}".
            
            The application must be fully functional and contain HTML, CSS and JavaScript.
            Return only the HTML page with built-in CSS and JavaScript without markdown formatting markers.
            Do not use the html and answer markers.
            HTML page must be complete and correct for iframe.
            All code must be embedded in one HTML file.
            
            Page start example:
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${request}</title>
                <style>
                    /* CSS styles */
                </style>
            </head>
            <body>
                <!-- HTML -->
                <script>
                    // JavaScript
                </script>
            </body>
            </html>
        `;

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Error during API request: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0] || !data.candidates[0].content.parts[0].text) {
            throw new Error('Incorrect API response format');
        }

        let generatedCode = data.candidates[0].content.parts[0].text;
        console.log("Got the code from Gemini (top):", generatedCode.substring(0, 100));

        generatedCode = cleanMarkdownCode(generatedCode);
        console.log("Clean code (start):", generatedCode.substring(0, 100));

        appContainer.innerHTML = '';
        const appWrapper = document.createElement('div');
        appWrapper.className = 'app-container-wrapper';
        appContainer.appendChild(appWrapper);

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '500px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';

        const viewCodeBtn = document.createElement('button');
        viewCodeBtn.className = 'view-code-btn';
        viewCodeBtn.textContent = 'Show code';
        viewCodeBtn.addEventListener('click', () => {
            showCodeModal(generatedCode, request);
        });

        appWrapper.appendChild(iframe);
        appWrapper.appendChild(viewCodeBtn);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(generatedCode);
        iframeDoc.close();

        function resizeIframe() {
            try {
                if (iframe.contentWindow.document.body) {
                    iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 20 + 'px';
                }
            } catch (e) {
                console.log('Unable to resize iframe:', e);
            }
        }

        iframe.onload = resizeIframe;
        setTimeout(resizeIframe, 500);
        setTimeout(resizeIframe, 1000);

        saveApp({
            id: Date.now().toString(),
            title: request,
            description: `Application created on request: "${request}"`,
            code: generatedCode,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error during application generation:', error);
        appContainer.innerHTML = `
            <div class="error-container">
                <h3>Error occurred during application generation</h3>
                <p>${error.message || 'Unknown bug'}</p>
            </div>
        `;
    }
}

function loadApp(app) {
    try {
        appContainer.innerHTML = '';
        const appWrapper = document.createElement('div');
        appWrapper.className = 'app-container-wrapper';
        appContainer.appendChild(appWrapper);

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '500px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '8px';

        const viewCodeBtn = document.createElement('button');
        viewCodeBtn.className = 'view-code-btn';
        viewCodeBtn.textContent = 'Показать код';
        viewCodeBtn.addEventListener('click', () => {
            showCodeModal(app.code, app.title);
        });

        appWrapper.appendChild(iframe);
        appWrapper.appendChild(viewCodeBtn);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(app.code);
        iframeDoc.close();

        function resizeIframe() {
            try {
                if (iframe.contentWindow.document.body) {
                    iframe.style.height = iframe.contentWindow.document.body.scrollHeight + 20 + 'px';
                }
            } catch (e) {
                console.log('Unable to resize iframe:', e);
            }
        }

        iframe.onload = resizeIframe;
        setTimeout(resizeIframe, 500);
        setTimeout(resizeIframe, 1000);

        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        document.querySelector('[data-tab="generator"]').classList.add('active');
        document.getElementById('generator').classList.add('active');
    } catch (error) {
        console.error('Error loading the application:', error);
        appContainer.innerHTML = `
            <div class="error-container">
                <h3>An error occurred while loading the application</h3>
                <p>${error.message || 'Unknown bug'}</p>
            </div>
        `;
    }
}
function showCodeModal(code, title) {
    const modal = document.createElement('div');
    modal.className = 'code-modal';

    modal.innerHTML = `
        <div class="code-modal-content">
            <div class="code-modal-header">
                <h3 class="code-modal-title">App code: ${escapeHtml(title)}</h3>
                <button class="code-modal-close">&times;</button>
            </div>
            <div class="code-modal-body">
                <pre class="code-display">${escapeHtml(code)}</pre>
            </div>
            <div class="code-actions">
                <button class="code-copy-btn">Copy</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.code-modal-close');
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            document.body.removeChild(modal);
        }
    });

    const copyBtn = modal.querySelector('.code-copy-btn');
    copyBtn.addEventListener('click', () => {
        const codeText = code;
        navigator.clipboard.writeText(codeText)
            .then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy code:', err);
                copyBtn.textContent = 'Copying error';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            });
    });
}


function loadAppLibrary() {
    try {
        const savedApps = getSavedApps();
        
        if (savedApps.length === 0) {
            appLibrary.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <h3>Library is empty</h3>
                    <p>Generate apps to see them here</p>
                </div>
            `;
            return;
        }
        
        appLibrary.innerHTML = '';
        
        savedApps.forEach(app => {
            const appCard = document.createElement('div');
            appCard.className = 'app-card';
            appCard.innerHTML = `
                <div class="app-title">${escapeHtml(app.title)}</div>
                <div class="app-description">${escapeHtml(app.description)}</div>
                <div style="font-size: 12px; color: #80868b; margin-top: 10px;">
                    Created: ${new Date(app.createdAt).toLocaleString()}
                </div>
            `;
            
            appCard.addEventListener('click', () => {
                loadApp(app);
            });
            
            appLibrary.appendChild(appCard);
        });
    } catch (error) {
        console.error('Error loading the library:', error);
        appLibrary.innerHTML = `
            <div class="error-container" style="grid-column: 1/-1;">
                <h3>Error while loading library</h3>
                <p>${error.message || 'Unknown bug'}</p>
            </div>
        `;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getSavedApps() {
    try {
        const appsJSON = localStorage.getItem('gemini-apps');
        return appsJSON ? JSON.parse(appsJSON) : [];
    } catch (error) {
        console.error('Error while retrieving applications from localStorage:', error);
        return [];
    }
}

function saveApp(app) {
    try {
        const savedApps = getSavedApps();
        savedApps.push(app);
        localStorage.setItem('gemini-apps', JSON.stringify(savedApps));
    } catch (error) {
        console.error('Error while saving application to localStorage:', error);
        const errorNotification = document.createElement('div');
        errorNotification.className = 'error-container';
        errorNotification.innerHTML = `
            <p>Failed to save application: ${error.message || 'Unknown bug'}</p>
        `;
        appResult.prepend(errorNotification);

        setTimeout(() => {
            errorNotification.remove();
        }, 5000);
    }
}

function similarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    
    const longerLength = longer.length;
    if (longerLength === 0) {
        return 1.0;
    }
    
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    
    const costs = new Array();
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) {
            costs[s2.length] = lastValue;
        }
    }
    return costs[s2.length];
}

function init() {
    if (document.getElementById('library').classList.contains('active')) {
        loadAppLibrary();
    }
}

init();