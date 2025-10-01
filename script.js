const cardWidthWithGap = 184 + 24;
let games = [];
let badgeBackgrounds = [];
let clusterize = null;
let disabledBadges = new Set(); // Track disabled badge types
const searchInput = document.getElementById('searchInput');
// get search params FILTER
const params = new URLSearchParams(window.location.search);

if (params.has('filter')) {
    const filterParam = params.get('filter');
    const enabledFilters = filterParam.split(',').map(f => f.trim());
    
    // Handle special case for "ALL" filter
    if (enabledFilters.includes('ALL') || enabledFilters.includes('all')) {
        // Don't set any URL filters - show all games
        window.urlFilters = null;
    } else {
        // Store enabled filters to use after badge data is loaded
        window.urlFilters = enabledFilters;
    }
}

async function getAllData() {
    const response = await fetch('/data.json');
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();

    // Wait for all getData calls to complete
    await Promise.all(data.map(item => getData('data/' + item.location, item.handler, item.groups, item.name)));
    
    // Remove duplicates based on name
    const uniqueGames = new Map();
    games.forEach(game => {
        if (!uniqueGames.has(game.title.toLowerCase())) {
            uniqueGames.set(game.title.toLowerCase(), game);
        }
    });
    games = Array.from(uniqueGames.values());
    
    // Sort games alphabetically by title (assuming a 'title' property)
    games.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    const style = document.createElement('style');
    let badgeBackgroundsText = '';
    let badgeFilter = document.getElementById('badgeFilter');

    // Group badges by section (only if section exists)
    const badgesBySection = new Map();
    const standaloneBadges = [];
    
    badgeBackgrounds.forEach((badge) => {
        if (badge[2]) { // Only group if section exists
            const section = badge[2];
            if (!badgesBySection.has(section)) {
                badgesBySection.set(section, []);
            }
            badgesBySection.get(section).push(badge);
        } else {
            // No section, treat as standalone
            standaloneBadges.push(badge);
        }
    });

    badgeBackgrounds.forEach((badge) => {
        badgeBackgroundsText += `.badge-${badge[0]} { background-color: ${badge[1]}; } .game-card:has(.badge-${badge[0]}) { border-bottom: 3px solid ${badge[1]}; }`;
    });

    // Add standalone badges first (no stacking)
    standaloneBadges.forEach((badge) => {
        let badgeSpan = document.createElement('span');
        badgeSpan.className = `badge badge-${badge[0]} badgeFilterItem`;
        badgeSpan.textContent = badge[0].toUpperCase().replace('_', ' ');
        badgeFilter.appendChild(badgeSpan);
    });

    // Create stacked badge filters for sections with multiple badges
    badgesBySection.forEach((badges, section) => {
        if (badges.length === 1) {
            // Single badge in section - treat as standalone (no stacking)
            let badgeSpan = document.createElement('span');
            badgeSpan.className = `badge badge-${badges[0][0]} badgeFilterItem`;
            badgeSpan.textContent = badges[0][0].toUpperCase().replace('_', ' ');
            badgeFilter.appendChild(badgeSpan);
        } else {
            // Multiple badges in section - create stacked filter
            let stackContainer = document.createElement('div');
            stackContainer.className = 'badge-stack-container';
            
            let mainBadge = document.createElement('span');
            mainBadge.className = `badge badge-${badges[0][0]} badgeFilterItem badge-stack-main`;
            mainBadge.textContent = section.toUpperCase();
            mainBadge.setAttribute('data-section', section);
            
            let hiddenBadges = document.createElement('div');
            hiddenBadges.className = 'badge-stack-hidden';
            
            badges.forEach((badge, index) => {
                let hiddenBadge = document.createElement('span');
                hiddenBadge.className = `badge badge-${badge[0]} badgeFilterItem badge-stack-item`;
                hiddenBadge.textContent = badge[0].toUpperCase().replace('_', ' ');
                hiddenBadge.style.zIndex = badges.length - index;
                hiddenBadges.appendChild(hiddenBadge);
            });
            
            stackContainer.appendChild(mainBadge);
            stackContainer.appendChild(hiddenBadges);
            badgeFilter.appendChild(stackContainer);
        }
    });

    // Add event listeners to all badge filter items
    document.querySelectorAll('.badgeFilterItem').forEach(badgeItem => {
        badgeItem.addEventListener('click', function() {
            if (this.classList.contains('badge-stack-main')) {
                // Handle section toggle
                const section = this.getAttribute('data-section');
                const sectionBadges = badgesBySection.get(section);
                const isDisabled = this.classList.toggle('disabled');
                
                // Toggle all badges in this section
                sectionBadges.forEach(badge => {
                    if (isDisabled) {
                        disabledBadges.add(badge[0]);
                    } else {
                        disabledBadges.delete(badge[0]);
                    }
                });
                
                // Update individual badge items in the stack
                this.parentElement.querySelectorAll('.badge-stack-item').forEach(item => {
                    if (isDisabled) {
                        item.classList.add('disabled');
                    } else {
                        item.classList.remove('disabled');
                    }
                });
            } else {
                // Handle individual badge toggle
                const badgeType = this.className.match(/badge-(\w+)/)[1];
                const isDisabled = this.classList.toggle('disabled');
                
                if (isDisabled) {
                    disabledBadges.add(badgeType);
                } else {
                    disabledBadges.delete(badgeType);
                }
            }
            
            // Re-filter and re-initialize clusterize
            initClusterize();
            
            // Update URL to reflect current filters
            updateURLFromFilters();
        });
    });

    // Add event listener to the all badge filter item
    document.getElementById('badgeFilterAll').addEventListener('click', function() {
        // toggle all on or off
        const allDisabled = document.querySelectorAll('.badgeFilterItem:not(.disabled)').length > 0;
        document.querySelectorAll('.badgeFilterItem').forEach(badgeItem => {
            if (allDisabled) {
                badgeItem.classList.add('disabled');
                const badgeType = badgeItem.className.match(/badge-(\w+)/)[1];
                if (badgeType) disabledBadges.add(badgeType);
            } else {
                badgeItem.classList.remove('disabled');
                const badgeType = badgeItem.className.match(/badge-(\w+)/)[1];
                if (badgeType) disabledBadges.delete(badgeType);
            }
        });
        // Re-filter and re-initialize clusterize
        initClusterize();
        
        // Update URL to reflect current filters
        updateURLFromFilters();
    });

    // Set initial disabled badges from URL filters
    if (window.urlFilters) {
        // Process URL filters: disable all badges except the ones specified
        const allBadgeTypes = new Set(badgeBackgrounds.map(badge => badge[0]));
        const enabledBadges = new Set();
        
        // Add directly specified badge types
        window.urlFilters.forEach(filter => {
            if (allBadgeTypes.has(filter)) {
                enabledBadges.add(filter);
            }
        });
        
        // Add badges from specified sections
        window.urlFilters.forEach(filter => {
            const sectionBadges = badgeBackgrounds.filter(badge => 
                badge[2] && badge[2].toLowerCase() === filter.toLowerCase()
            );
            sectionBadges.forEach(badge => enabledBadges.add(badge[0]));
        });
        
        // Disable all badges that aren't enabled
        disabledBadges = new Set([...allBadgeTypes].filter(badge => !enabledBadges.has(badge)));
        
        // Clean up
        delete window.urlFilters;
    }
    
    // Update UI to reflect disabled badges
    document.querySelectorAll('.badgeFilterItem').forEach(badgeItem => {
        const badgeType = badgeItem.className.match(/badge-(\w+)/)[1];
        if (disabledBadges.has(badgeType)) {
            badgeItem.classList.add('disabled');
        } else {
            badgeItem.classList.remove('disabled');
        }
    });

    style.textContent = badgeBackgroundsText;
    document.head.appendChild(style);
    
    // Set initial navbar active state
    setNavbarActiveState();
    
    // Add click handlers to navigation links
    setupNavClickHandlers();
}

async function getData(location, handler, groups, section) {
    for (const group of groups) {
        badgeBackgrounds.push(group);
    }
    const getGameInfo = new Function('game', 'group', 'i', 'j', handler);
    try {
        const response = await fetch(location);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        let data = await response.json();

        for (let i = 0; i < data.length; i++) {
            const group = data[i];
            for (let j = 0; j < group.games.length; j++) {
                const game = group.games[j];
                const gameInfo = getGameInfo(game, group, i, j);
                // Add global index to the game
                gameInfo.index = games.length;
                gameInfo.section = section;
                games.push(gameInfo);
            }
        }
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

function generateRows(filteredGames) {
    const cardsPerRow = Math.max(Math.floor(window.innerWidth / cardWidthWithGap), 1);
    const rows = [];

    for (let i = 0; i < filteredGames.length; i += cardsPerRow) {
        let rowHTML = '<div class="game-row">';
        for (let j = 0; j < cardsPerRow && (i + j) < filteredGames.length; j++) {
        const game = filteredGames[i + j];
        console.log(game);
        let gameURL = btoa(`1:${game.section}:${game.index}`);

        rowHTML += `
            <a href="${game.url}" class="game-card" target="_blank">
            <span class="badge badge-${game.type}">${game.type.toUpperCase().replace("_", " ")}</span>
            <img src="${game.img}" alt="${game.title}">
            <div class="title">${game.title}</div>
            </a>`;
        }
        rowHTML += '</div>';
        rows.push(rowHTML);
    }

    return rows;
}

function initClusterize(filteredGames = filterGames()) {
    const rows = generateRows(filteredGames);

    if (clusterize) clusterize.destroy(true);

    clusterize = new Clusterize({
        rows,
        scrollId: 'scrollArea',
        contentId: 'contentArea',
        tag: 'div',
        rows_in_block: 4,
        blocks_in_cluster: 2
    });
}

function filterGames() {
    let filtered = games;
    let query = document.getElementById('searchInput').value.trim();
    
    // Apply search filter if query exists
    if (query) {
        const lowerQuery = query.toLowerCase();
        filtered = filtered.filter(game => game.title.toLowerCase().includes(lowerQuery));
    }
    
    // Apply badge filter - exclude disabled badge types
    if (disabledBadges.size > 0) {
        filtered = filtered.filter(game => !disabledBadges.has(game.type));
    }
    
    return filtered;
}

function init() {
    // Initialize once
    initClusterize()

    // Debounced resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            initClusterize();
        }, 200);
    });

    searchInput.addEventListener('input', () => {
        initClusterize();
    });

    // Keyboard shortcut: Press "/" to focus search
    window.addEventListener('keydown', e => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

getAllData().then(() => {
    setTimeout(init, 100);
}).catch(error => {
    console.error('Initialization failed:', error);
});

function setTheme(theme) {
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function updateURLFromFilters() {
    // Get all enabled badges (badges that are NOT disabled)
    const allBadgeTypes = Array.from(new Set(badgeBackgrounds.map(badge => badge[0])));
    const enabledBadges = allBadgeTypes.filter(badge => !disabledBadges.has(badge));
    
    // Group badges by section to check for complete sections
    const badgesBySection = new Map();
    const standaloneBadges = [];
    
    badgeBackgrounds.forEach((badge) => {
        if (badge[2]) { // Has section
            const section = badge[2];
            if (!badgesBySection.has(section)) {
                badgesBySection.set(section, []);
            }
            badgesBySection.get(section).push(badge[0]);
        } else {
            standaloneBadges.push(badge[0]);
        }
    });
    
    // Check which complete sections are enabled
    const enabledSections = [];
    const remainingEnabledBadges = [...enabledBadges];
    
    badgesBySection.forEach((sectionBadges, section) => {
        const allSectionBadgesEnabled = sectionBadges.every(badge => enabledBadges.includes(badge));
        if (allSectionBadgesEnabled) {
            enabledSections.push(section);
            // Remove section badges from remaining list
            sectionBadges.forEach(badge => {
                const index = remainingEnabledBadges.indexOf(badge);
                if (index > -1) remainingEnabledBadges.splice(index, 1);
            });
        }
    });
    
    // Build filter string
    let filterParts = [...enabledSections, ...remainingEnabledBadges];
    
    // Update URL with current filters
    const currentURL = new URL(window.location);
    if (enabledBadges.length === allBadgeTypes.length) {
        // All badges enabled - use "ALL"
        currentURL.searchParams.set('filter', 'ALL');
    } else if (enabledBadges.length === 0) {
        // No badges enabled - remove filter param
        currentURL.searchParams.delete('filter');
    } else {
        // Some badges/sections enabled
        currentURL.searchParams.set('filter', filterParts.join(','));
    }
    
    // Update URL without page reload
    window.history.replaceState({}, '', currentURL);
    
    // Update navbar active state
    setNavbarActiveState();
}

function setNavbarActiveState() {
    // Remove active class from all nav links
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Get current URL
    const currentURL = window.location.pathname + window.location.search;
    
    // Find matching nav link and set it active
    document.querySelectorAll('nav a').forEach(link => {
        if (link.getAttribute('href') === currentURL) {
            link.classList.add('active');
        }
    });
}

function setupNavClickHandlers() {
    document.querySelectorAll('nav a[href*="games.html"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Parse the target URL
            const url = new URL(this.href, window.location.origin);
            const targetFilter = url.searchParams.get('filter');
            
            // Update current URL
            const currentURL = new URL(window.location);
            if (targetFilter) {
                currentURL.searchParams.set('filter', targetFilter);
            } else {
                currentURL.searchParams.delete('filter');
            }
            
            // Update URL without page reload
            window.history.pushState({}, '', currentURL);
            
            // Apply the new filters
            applyFiltersFromURL();
            
            // Update navbar active state
            setNavbarActiveState();
        });
    });
}

function applyFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    
    if (!filterParam || filterParam.includes('ALL') || filterParam.includes('all')) {
        // Show all games - clear disabled badges
        disabledBadges.clear();
    } else {
        // Apply specific filters
        const enabledFilters = filterParam.split(',').map(f => f.trim());
        const allBadgeTypes = new Set(badgeBackgrounds.map(badge => badge[0]));
        const enabledBadges = new Set();
        
        // Add directly specified badge types
        enabledFilters.forEach(filter => {
            if (allBadgeTypes.has(filter)) {
                enabledBadges.add(filter);
            }
        });
        
        // Add badges from specified sections
        enabledFilters.forEach(filter => {
            const sectionBadges = badgeBackgrounds.filter(badge => 
                badge[2] && badge[2].toLowerCase() === filter.toLowerCase()
            );
            sectionBadges.forEach(badge => enabledBadges.add(badge[0]));
        });
        
        // Disable all badges that aren't enabled
        disabledBadges = new Set([...allBadgeTypes].filter(badge => !enabledBadges.has(badge)));
    }
    
    // Update UI to reflect disabled badges
    document.querySelectorAll('.badgeFilterItem').forEach(badgeItem => {
        const badgeType = badgeItem.className.match(/badge-(\w+)/)[1];
        if (disabledBadges.has(badgeType)) {
            badgeItem.classList.add('disabled');
        } else {
            badgeItem.classList.remove('disabled');
        }
    });
    
    // Re-filter and re-initialize clusterize
    initClusterize();
}