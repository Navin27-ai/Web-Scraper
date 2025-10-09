// Global variables
let scrapingData = {
    text: '',
    links: [],
    images: [],
    url: '',
    aiAnalysis: null
};

// DOM elements
const urlInput = document.getElementById('url-input');
const scrapeBtn = document.getElementById('scrape-btn');
const loading = document.getElementById('loading');
const results = document.getElementById('results');
const error = document.getElementById('error');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalDownload = document.getElementById('modal-download');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    scrapeBtn.addEventListener('click', startScraping);
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            startScraping();
        }
    });
    
    // Download all button
    document.getElementById('download-all').addEventListener('click', downloadAllData);
    
    // Modal download button
    modalDownload.addEventListener('click', downloadModalContent);
});

// Main scraping function
async function startScraping() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('Please enter a valid URL');
        return;
    }
    
    // Validate URL
    if (!isValidUrl(url)) {
        showError('Please enter a valid URL format (e.g., https://example.com)');
        return;
    }
    
    // Get extraction options
    const options = {
        extractText: document.getElementById('extract-text').checked,
        extractLinks: document.getElementById('extract-links').checked,
        extractImages: document.getElementById('extract-images').checked,
        downloadImages: document.getElementById('download-images').checked
    };
    
    // Check if at least one option is selected
    if (!options.extractText && !options.extractLinks && !options.extractImages) {
        showError('Please select at least one extraction option');
        return;
    }
    
    // Show loading state
    showLoading();
    hideError();
    hideResults();
    
    try {
        // Call Flask backend API
        const scrapedData = await scrapeWebsite(url, options);
        
        // Store data globally
        scrapingData = scrapedData;
        
        // Display results
        displayResults(scrapedData);
        
    } catch (err) {
        showError(`Scraping failed: ${err.message}`);
    }
}

// Scrape website using Flask backend API
async function scrapeWebsite(url, options) {
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                extract_text: options.extractText,
                extract_links: options.extractLinks,
                extract_images: options.extractImages,
                download_images: options.downloadImages
            })
        });
        
        // Attempt to parse JSON safely even for non-OK responses
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        if (!response.ok) {
            // Try JSON first, then fallback to text
            let message = `HTTP ${response.status}`;
            if (isJson) {
                try {
                    const errJson = await response.json();
                    message = errJson.error || JSON.stringify(errJson);
                } catch (_) {
                    // ignore JSON parse error and try text
                    const errText = await response.text();
                    message = errText || message;
                }
            } else {
                const errText = await response.text();
                message = errText || message;
            }
            throw new Error(message || 'Scraping failed');
        }

        // OK response: prefer JSON, but be defensive
        if (isJson) {
            try {
                return await response.json();
            } catch (_) {
                // Unexpected empty body
                throw new Error('Empty JSON response from server');
            }
        } else {
            // Fallback if server sent non-JSON content
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (_) {
                throw new Error(text || 'Unexpected non-JSON response from server');
            }
        }
        
    } catch (error) {
        throw new Error(`API Error: ${error.message}`);
    }
}

// Display scraping results
function displayResults(data) {
    hideLoading();
    
    // Update counts
    document.getElementById('text-count').textContent = data.text.length;
    document.getElementById('links-count').textContent = data.links.length;
    document.getElementById('images-count').textContent = data.images.length;
    
    // Update previews
    updateTextPreview(data.text);
    updateLinksPreview(data.links);
    updateImagesPreview(data.images);
    
    // Show results
    results.classList.remove('hidden');
}

// Update text preview
function updateTextPreview(text) {
    const preview = document.getElementById('text-preview');
    const truncated = text.length > 300 ? text.substring(0, 300) + '...' : text;
    preview.textContent = truncated;
}

// Update links preview
function updateLinksPreview(links) {
    const preview = document.getElementById('links-preview');
    const html = links.slice(0, 5).map(link => 
        `<div class="link-item">
            <strong>${link.text || 'No text'}</strong><br>
            <small>${link.url}</small>
        </div>`
    ).join('');
    preview.innerHTML = html;
}

// Update images preview
function updateImagesPreview(images) {
    const preview = document.getElementById('images-preview');
    const html = images.slice(0, 3).map(img => 
        `<div class="image-item">
            <div class="image-preview">
                <img src="${img.url}" alt="${img.alt || 'No alt text'}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div style="display:none; padding:20px; text-align:center; color:#9CFE62;">Image failed to load</div>
                <div class="image-preview-info">
                    <div class="image-preview-title">${img.alt || 'No alt text'}</div>
                    <div class="image-preview-url">${img.url}</div>
                </div>
            </div>
        </div>`
    ).join('');
    preview.innerHTML = html;
}

// View full content in modal
function viewFullContent(type) {
    let title, content;
    
    switch(type) {
        case 'text':
            title = 'Full Text Content';
            content = `<div class="full-text">${scrapingData.text}</div>`;
            break;
        case 'links':
            title = 'All Links';
            content = scrapingData.links.map((link, index) => 
                `<div class="link-item-full">
                    <div class="link-number">${index + 1}.</div>
                    <div class="link-content">
                        <div class="link-text"><strong>${link.text || 'No text'}</strong></div>
                        <div class="link-url">${link.url}</div>
                    </div>
                </div>`
            ).join('');
            break;
        case 'images':
            title = 'All Images';
            content = `
                <div class="image-display">
                    ${scrapingData.images.map((img, index) => 
                        `<div class="image-preview">
                            <img src="${img.url}" alt="${img.alt || 'No alt text'}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <div style="display:none; padding:20px; text-align:center; color:#9CFE62; background:rgba(0,0,0,0.6); border-radius:8px;">Image failed to load</div>
                            <div class="image-preview-info">
                                <div class="image-preview-title">${img.alt || 'No alt text'}</div>
                                <div class="image-preview-url">${img.url}</div>
                            </div>
                        </div>`
                    ).join('')}
                </div>
            `;
            break;
    }
    
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    modalDownload.setAttribute('data-type', type);
    modal.classList.remove('hidden');
}

// Close modal
function closeModal() {
    modal.classList.add('hidden');
}

// Download modal content
async function downloadModalContent() {
    const type = modalDownload.getAttribute('data-type');
    
    try {
        const response = await fetch(`/api/download/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(scrapingData)
        });
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extracted_${type}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        // Fallback to client-side download
        let filename, content;
        
        switch(type) {
            case 'text':
                filename = 'extracted_text.txt';
                content = scrapingData.text;
                break;
            case 'links':
                filename = 'extracted_links.txt';
                content = scrapingData.links.map((link, index) => 
                    `${index + 1}. ${link.text || 'No text'} -> ${link.url}`
                ).join('\n');
                break;
            case 'images':
                filename = 'extracted_images.txt';
                content = scrapingData.images.map((img, index) => 
                    `${index + 1}. Alt: ${img.alt || 'No alt text'} | Title: ${img.title || 'No title'} | URL: ${img.url}`
                ).join('\n');
                break;
        }
        
        downloadFile(filename, content);
    }
}

// Download all data
async function downloadAllData() {
    try {
        const response = await fetch('/api/download-all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(scrapingData)
        });
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scraping_results.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        // Fallback to client-side download
        const allData = {
            url: scrapingData.url,
            timestamp: new Date().toISOString(),
            text: scrapingData.text,
            links: scrapingData.links,
            images: scrapingData.images
        };
        
        const content = JSON.stringify(allData, null, 2);
        downloadFile('scraping_results.json', content);
    }
}

// Download file utility
function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Utility functions
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function showLoading() {
    loading.classList.remove('hidden');
    scrapeBtn.disabled = true;
    scrapeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scraping...';
}

function hideLoading() {
    loading.classList.add('hidden');
    scrapeBtn.disabled = false;
    scrapeBtn.innerHTML = '<i class="fas fa-play"></i> SCRAP NOW';
}

function showError(message) {
    document.getElementById('error-message').textContent = message;
    error.classList.remove('hidden');
}

function hideError() {
    error.classList.add('hidden');
}

function showResults() {
    results.classList.remove('hidden');
}

function hideResults() {
    results.classList.add('hidden');
}

// Close modal when clicking outside
modal.addEventListener('click', function(e) {
    if (e.target === modal) {
        closeModal();
    }
});

// AI Analysis Functions
async function runAIAnalysis() {
    if (!scrapingData.text && !scrapingData.links.length && !scrapingData.images.length) {
        showError('No data to analyze. Please scrape a website first.');
        return;
    }
    
    // Show loading state
    showAILoading();
    
    try {
        // Simulate AI analysis (in a real app, this would call an AI API)
        const analysis = await performAIAnalysis();
        
        // Store analysis data
        scrapingData.aiAnalysis = analysis;
        
        // Display results
        displayAIAnalysis(analysis);
        
    } catch (error) {
        showError(`AI Analysis failed: ${error.message}`);
    }
}

async function performAIAnalysis() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const text = scrapingData.text;
    const links = scrapingData.links;
    const images = scrapingData.images;
    
    // Simulate AI analysis results
    const analysis = {
        sentiment: analyzeSentiment(text),
        keywords: extractKeywords(text),
        contentType: categorizeContent(text, links, images),
        readability: calculateReadability(text),
        security: analyzeSecurity(links),
        insights: generateInsights(text, links, images)
    };
    
    return analysis;
}

function analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'awesome', 'perfect'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing', 'poor', 'sad', 'angry'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positive = 0;
    let negative = 0;
    
    words.forEach(word => {
        if (positiveWords.includes(word)) positive++;
        if (negativeWords.includes(word)) negative++;
    });
    
    if (positive > negative) return { score: 'Positive', value: `${positive} positive indicators` };
    if (negative > positive) return { score: 'Negative', value: `${negative} negative indicators` };
    return { score: 'Neutral', value: 'Balanced sentiment' };
}

function extractKeywords(text) {
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const wordCount = {};
    
    words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    const sorted = Object.entries(wordCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([word, count]) => `${word} (${count})`);
    
    return { keywords: sorted.join(', '), count: sorted.length };
}

function categorizeContent(text, links, images) {
    const categories = [];
    
    if (text.includes('shop') || text.includes('buy') || text.includes('price')) categories.push('E-commerce');
    if (text.includes('news') || text.includes('article') || text.includes('blog')) categories.push('News/Blog');
    if (text.includes('contact') || text.includes('about') || text.includes('company')) categories.push('Corporate');
    if (images.length > 5) categories.push('Media-rich');
    if (links.length > 20) categories.push('Link-heavy');
    
    return categories.length > 0 ? categories.join(', ') : 'General Content';
}

function calculateReadability(text) {
    const sentences = text.split(/[.!?]+/).length;
    const words = text.split(/\s+/).length;
    const avgWordsPerSentence = words / sentences;
    
    if (avgWordsPerSentence < 10) return { level: 'Easy', value: `${avgWordsPerSentence.toFixed(1)} words/sentence` };
    if (avgWordsPerSentence < 20) return { level: 'Medium', value: `${avgWordsPerSentence.toFixed(1)} words/sentence` };
    return { level: 'Complex', value: `${avgWordsPerSentence.toFixed(1)} words/sentence` };
}

function analyzeSecurity(links) {
    const suspiciousDomains = ['bit.ly', 'tinyurl.com', 't.co'];
    const httpsLinks = links.filter(link => link.url.startsWith('https://')).length;
    const httpLinks = links.filter(link => link.url.startsWith('http://')).length;
    const suspiciousLinks = links.filter(link => 
        suspiciousDomains.some(domain => link.url.includes(domain))
    ).length;
    
    let security = 'Good';
    if (httpLinks > httpsLinks) security = 'Warning';
    if (suspiciousLinks > 0) security = 'Caution';
    
    return { 
        level: security, 
        value: `${httpsLinks} secure, ${httpLinks} insecure, ${suspiciousLinks} suspicious` 
    };
}

function generateInsights(text, links, images) {
    const insights = [];
    
    if (text.length > 1000) insights.push('Content-rich page with substantial text');
    if (links.length > 50) insights.push('Highly interconnected with many links');
    if (images.length > 10) insights.push('Visual-heavy content with multiple images');
    if (text.includes('@') && text.includes('.')) insights.push('Contains contact information');
    if (links.some(link => link.url.includes('social'))) insights.push('Includes social media links');
    
    return insights.length > 0 ? insights : ['Standard webpage with basic content'];
}

function showAILoading() {
    const preview = document.getElementById('ai-preview');
    preview.innerHTML = `
        <div class="ai-loading">
            <div class="ai-spinner"></div>
            <div class="ai-loading-text">AI is analyzing your content...</div>
        </div>
    `;
}

function displayAIAnalysis(analysis) {
    const preview = document.getElementById('ai-preview');
    const count = document.getElementById('ai-count');
    
    // Update count
    count.textContent = '✨';
    
    // Display insights
    preview.innerHTML = `
        <div class="ai-insights">
            <div class="ai-insight-item">
                <div class="ai-insight-title">Sentiment</div>
                <div class="ai-insight-value">${analysis.sentiment.score}</div>
                <div class="ai-insight-description">${analysis.sentiment.value}</div>
            </div>
            <div class="ai-insight-item">
                <div class="ai-insight-title">Keywords</div>
                <div class="ai-insight-value">${analysis.keywords.count} found</div>
                <div class="ai-insight-description">${analysis.keywords.keywords}</div>
            </div>
            <div class="ai-insight-item">
                <div class="ai-insight-title">Content Type</div>
                <div class="ai-insight-value">${analysis.contentType}</div>
                <div class="ai-insight-description">AI categorization</div>
            </div>
            <div class="ai-insight-item">
                <div class="ai-insight-title">Readability</div>
                <div class="ai-insight-value">${analysis.readability.level}</div>
                <div class="ai-insight-description">${analysis.readability.value}</div>
            </div>
            <div class="ai-insight-item">
                <div class="ai-insight-title">Security</div>
                <div class="ai-insight-value">${analysis.security.level}</div>
                <div class="ai-insight-description">${analysis.security.value}</div>
            </div>
        </div>
    `;
}

// Add some CSS for the modal content
const style = document.createElement('style');
style.textContent = `
    .full-text {
        white-space: pre-wrap;
        line-height: 1.6;
        font-family: 'Courier New', monospace;
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #dee2e6;
    }
    
    .link-item-full, .image-item-full {
        display: flex;
        gap: 15px;
        padding: 15px;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        margin-bottom: 10px;
        background: #f8f9fa;
    }
    
    .link-number, .image-number {
        background: #667eea;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        flex-shrink: 0;
    }
    
    .link-content, .image-content {
        flex: 1;
    }
    
    .link-text, .image-alt {
        margin-bottom: 5px;
        color: #333;
    }
    
    .link-url, .image-url {
        color: #666;
        font-size: 0.9rem;
        word-break: break-all;
    }
    
    .image-title {
        color: #555;
        font-size: 0.9rem;
        margin-bottom: 5px;
    }
    
    .link-item, .image-item {
        padding: 10px;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        margin-bottom: 8px;
        background: white;
    }
    
    .link-item strong, .image-item strong {
        color: #333;
    }
    
    .link-item small, .image-item small {
        color: #666;
        word-break: break-all;
    }
    
    .ai-loading {
        text-align: center;
        padding: 20px;
    }
    
    .ai-spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        margin: 0 auto 15px;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .ai-loading-text {
        color: #9CFE62;
        font-size: 14px;
    }
    
    .ai-insights {
        display: grid;
        gap: 10px;
    }
    
    .ai-insight-item {
        background: rgba(156, 254, 98, 0.1);
        padding: 10px;
        border-radius: 6px;
        border: 1px solid rgba(156, 254, 98, 0.3);
    }
    
    .ai-insight-title {
        font-weight: bold;
        color: #9CFE62;
        font-size: 12px;
        text-transform: uppercase;
        margin-bottom: 5px;
    }
    
    .ai-insight-value {
        font-size: 14px;
        color: #333;
        margin-bottom: 3px;
    }
    
    .ai-insight-description {
        font-size: 12px;
        color: #666;
    }
`;
document.head.appendChild(style);