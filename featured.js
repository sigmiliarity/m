// Game card click handler - paste this in console
function setupGameCardCapture() {
    // Remove any existing listeners
    document.removeEventListener('click', gameCardClickHandler);
    
    // Add the click handler
    document.addEventListener('click', gameCardClickHandler);
    
    console.log('🎮 Game card capture activated! Click any game card to generate featured HTML.');
}

function gameCardClickHandler(event) {
    // Check if clicked element or its parent is a game card
    let gameCard = event.target.closest('.game-card');
    
    if (!gameCard) return;
    
    // Prevent the default navigation
    event.preventDefault();
    event.stopPropagation();
    
    // Extract game information
    const href = gameCard.getAttribute('href') || gameCard.querySelector('a')?.getAttribute('href');
    const img = gameCard.querySelector('img');
    const title = gameCard.querySelector('.title');
    
    if (!href || !img || !title) {
        console.warn('❌ Could not extract complete game information');
        return;
    }
    
    // Convert URLs to relative paths
    let relativeHref = href;
    let relativeSrc = img.src;
    
    // Convert href to relative
    if (relativeHref.startsWith('/')) {
        relativeHref = '.' + relativeHref;
    } else if (relativeHref.startsWith('http://localhost:5500/')) {
        relativeHref = './' + relativeHref.replace('http://localhost:5500/', '');
    } else if (relativeHref.startsWith('http://')) {
        // Remove protocol and domain, keep path
        relativeHref = './' + relativeHref.split('/').slice(3).join('/');
    }
    
    // Convert img src to absolute path (remove localhost but keep /)
    if (relativeSrc.startsWith('http://localhost:5500/')) {
        relativeSrc = relativeSrc.replace('http://localhost:5500', '');
    } else if (relativeSrc.startsWith('http://')) {
        // Remove protocol and domain, keep path with leading /
        relativeSrc = '/' + relativeSrc.split('/').slice(3).join('/');
    }
    
    // Generate the featured game HTML (without badge)
    const featuredHTML = `<a href="${relativeHref}" class="game-card" target="_blank">
                    <img src="${relativeSrc}" alt="${title.textContent}">
                    <div class="title">${title.textContent}</div>
                </a>`;
    
    // Log the result
    console.log(`🎯 Generated featured game HTML for "${title.textContent}":`);
    console.log(featuredHTML);
    
    // Copy to clipboard if possible
    if (navigator.clipboard) {
        navigator.clipboard.writeText(featuredHTML).then(() => {
            console.log('📋 HTML copied to clipboard!');
        }).catch(() => {
            console.log('📋 Could not copy to clipboard automatically');
        });
    }
    
    // Also create a temporary textarea for manual copying
    const textarea = document.createElement('textarea');
    textarea.value = featuredHTML;
    textarea.style.position = 'fixed';
    textarea.style.top = '10px';
    textarea.style.left = '10px';
    textarea.style.width = '400px';
    textarea.style.height = '120px';
    textarea.style.zIndex = '10000';
    textarea.style.background = '#1a1a1a';
    textarea.style.color = '#fff';
    textarea.style.border = '2px solid #ff3030';
    textarea.style.borderRadius = '8px';
    textarea.style.padding = '10px';
    textarea.style.fontSize = '12px';
    document.body.appendChild(textarea);
    textarea.select();
    
    // Remove textarea after 5 seconds
    setTimeout(() => {
        if (textarea.parentNode) {
            textarea.parentNode.removeChild(textarea);
        }
    }, 5000);
    
    console.log('📝 HTML also shown in temporary textarea (5 seconds)');
}

// Auto-start the capture
setupGameCardCapture();