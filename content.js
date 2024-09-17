let badgesLoaded = 0;
let totalBadges = 0;

window.addEventListener('load', function () {
  console.log('Page fully loaded, including other extensions.');

  let checkForBadgeContainer = setInterval(function () {
    let badgeContainer = document.querySelector('.game-badges-list');
    if (badgeContainer) {
      clearInterval(checkForBadgeContainer);

      const stackList = document.querySelector(
        '.virtual-event-game-details-container .stack-list'
      );

      if (stackList) {
        const itemCount = stackList.children.length;

        if (itemCount === 1) {
          // Apply 1,1 grid configuration
          stackList.style.gridTemplateColumns = '1fr';
        } else if (itemCount >= 2) {
          // Apply 2,1 grid configuration
          stackList.style.gridTemplateColumns = 'repeat(2, 1fr)';
        }
      }

      organizeBadges();
    } else {
      console.log('Badge container not found, retrying...');
    }
  }, 500);
});

async function organizeBadges() {
  let ownedContainer = document.querySelector('.game-badges-list');
  ownedContainer.classList.add('content-hidden-and-frozen');
  createLoadingIndicator();
  const gameBadges = await getBadges();
  document.querySelector(
    '#loading-indicator span'
  ).textContent = `Fetching user badges... (First time this runs it may take a while)`;
  await updateBadgeStorage();
  await generateBadges(gameBadges, ownedContainer);
  document
    .querySelector('.game-badges-list .btn-control-md')
    .parentElement.remove();
  document.querySelector(
    '#loading-indicator span'
  ).textContent = `Organizing badges...`;
  let notOwnedContainer = document.createElement('div');
  notOwnedContainer.classList.add('game-badges-list');
  notOwnedContainer.classList.add('content-hidden-and-frozen');
  notOwnedContainer.classList.add('stack');
  notOwnedContainer.classList.add('badge-container');

  ownedContainer.parentNode.insertBefore(
    notOwnedContainer,
    ownedContainer.nextSibling
  );

  notOwnedContainer.innerHTML = `<div class="container-header"><h2>Locked Badges</h2></div><ul class="stack-list"></ul>`;

  await sortBadgesByWonEver(ownedContainer);
  await moveBadgesWithOpacity(ownedContainer, notOwnedContainer);

  setTimeout(() => {
    ownedContainer.getElementsByClassName('container-header')[0].innerHTML =
      '<h2>Unlocked Badges</h2>';
    notOwnedContainer.getElementsByClassName('container-header')[0].innerHTML =
      '<h2>Locked Badges</h2>';

    setTimeout(() => {
      document.querySelector(
        '#loading-indicator span'
      ).textContent = `Formatting badges...`;

      setTitleIfOverflow(ownedContainer);
      setTitleIfOverflow(notOwnedContainer);

      makeCarousel(ownedContainer);
      makeCarousel(notOwnedContainer);

      ownedContainer.classList.remove('content-hidden-and-frozen');
      notOwnedContainer.classList.remove('content-hidden-and-frozen');
      document.querySelector('#loading-indicator').remove();
    }, 1000);
  }, 1000);
}

function getUserIdFromDOM() {
  const avatarElement = document.querySelector('a[href*="/users/"]');
  if (avatarElement) {
    const urlParts = avatarElement.href.split('/');
    return urlParts[4]; // The userId should be at index 4
  }
  return null;
}

async function updateBadgeStorage() {
  const userId = getUserIdFromDOM();
  await checkAndUpdateBadges(userId);
  console.log('Badges updated.');
}

async function moveBadgesWithOpacity(ownedContainer, notOwnedContainer) {
  const notOwnedList = notOwnedContainer.querySelector(
    '.badge-container .stack-list'
  );
  const badgeRows = Array.from(ownedContainer.querySelectorAll('.badge-row'));
  let index = 0;
  const url = new URL(window.location.href);
  const placeId = url.pathname.split('/')[2];

  // Function to move a batch of badges
  async function moveNextBatch() {
    const batchSize = 50; // Adjust batch size to avoid freezing the browser

    // Set opacity to 0.5 for all badge rows
    for (let i = 0; i < batchSize && index < badgeRows.length; i++, index++) {
      const row = badgeRows[index];
      row.style.opacity = '0.5';
    }

    // Check ownership of badges and adjust opacity
    await getBadgesForPlace(placeId).then((badgeNames) => {
      badgeRows.forEach((row) => {
        const badgeNameElement = row.querySelector('.badge-name'); // Adjust selector as needed
        const badgeName = badgeNameElement
          ? badgeNameElement.textContent.trim()
          : '';

        if (badgeNames.includes(badgeName)) {
          row.style.opacity = '1'; // Change opacity to 0 if badge is owned
        } else {
          notOwnedList.appendChild(row); // Otherwise, keep it in the not-owned list
        }
      });

      // If more badges need to be processed, call this function again using setTimeout
      if (index < badgeRows.length) {
        setTimeout(moveNextBatch, 50); // Adjust interval to fine-tune performance
      }
    });
  }

  moveNextBatch();
}

async function getBadges() {
  try {
    const url = new URL(window.location.href);
    const placeId = url.pathname.split('/')[2];
    console.log(placeId);

    const universeResponse = await fetch(
      `https://apis.roblox.com/universes/v1/places/${placeId}/universe`
    );
    const universeData = await universeResponse.json();
    const universeId = universeData.universeId;

    let nextPageCursor = null;
    const pageSize = 100;
    const gameBadges = []; // Initialize the array to store badge data

    // Function to introduce a delay
    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    do {
      const badgesResponse = await fetch(
        `https://badges.roblox.com/v1/universes/${universeId}/badges?limit=${pageSize}${
          nextPageCursor ? `&cursor=${nextPageCursor}` : ''
        }`
      );
      const badgesData = await badgesResponse.json();

      // Push the fetched badges into the gameBadges array
      gameBadges.push(...badgesData.data);

      nextPageCursor = badgesData.nextPageCursor;

      // Introduce a small delay to avoid hitting rate limits
      await delay(500); // 500 milliseconds delay
    } while (nextPageCursor);

    totalBadges = gameBadges.length;
    console.log(`Total badges: ${gameBadges.length}`);
    return gameBadges; // Return the array containing all the badges
  } catch (error) {
    console.error('Error fetching badges:', error);
    throw error;
  }
}

function getRarityLevel(rarity) {
  if (rarity >= 90) return 'Freebie';
  if (rarity >= 80) return 'Cake Walk';
  if (rarity >= 50) return 'Easy';
  if (rarity >= 30) return 'Moderate';
  if (rarity >= 20) return 'Challenging';
  if (rarity >= 10) return 'Hard';
  if (rarity >= 5) return 'Extreme';
  if (rarity >= 1) return 'Insane';
  return 'Impossible';
}

async function fetchBadgeImagesInChunks(badgeIds) {
  const chunkSize = 20;
  const maxRetries = 3; // Maximum number of retries
  const retryDelay = 5000; // Delay in milliseconds (5 seconds)
  let imagesLoaded = 0;
  const imageMap = {};

  // Helper function to handle a chunk of badge IDs with retry logic
  async function fetchChunk(chunk) {
    const apiUrl = `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${chunk.join(
      ','
    )}&size=150x150&format=Png&isCircular=true`;

    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data && data.data) {
          data.data.forEach((badge) => {
            imageMap[badge.targetId] = badge.imageUrl;
            imagesLoaded += 1;
            document.querySelector(
              '#loading-indicator span'
            ).textContent = `Loading badge images... (${imagesLoaded}/${totalBadges})`;
          });
          return; // Exit the loop if successful
        } else {
          throw new Error('No data received');
        }
      } catch (error) {
        attempts += 1;
        if (attempts >= maxRetries) {
          throw new Error(
            `Failed to fetch badge images after ${maxRetries} attempts`
          );
        }
        console.warn(`Retrying fetch for chunk due to error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay)); // Wait before retrying
      }
    }
  }

  // Process all badges in chunks of 20
  for (let i = 0; i < badgeIds.length; i += chunkSize) {
    const chunk = badgeIds.slice(i, i + chunkSize);
    await fetchChunk(chunk); // Await each chunk to avoid overwhelming the API
  }

  return imageMap;
}

async function generateBadges(gameBadges, ownedContainer) {
  const chunkSize = 20; // Number of badges to process in each chunk
  let stackList = ownedContainer.querySelector('.stack-list');
  stackList.innerHTML = ''; // Clear the current list of badges

  // Fetch badge images based on their IDs
  const badgeIds = gameBadges.map((badge) => badge.id);
  const badgeImages = await fetchBadgeImagesInChunks(badgeIds);
  const totalBadges = gameBadges.length;

  // Function to update the loading indicator
  function updateLoadingIndicator() {
    document.querySelector(
      '#loading-indicator span'
    ).textContent = `Loading badges... (${badgesLoaded}/${totalBadges})`;
  }

  const { badgeAnimations } = await new Promise((resolve) => {
    chrome.storage.local.get(['badgeAnimations'], (result) => {
      resolve({ badgeAnimations: result.badgeAnimations !== false }); // Default to true if not set
    });
  });

  // Function to create and append badge rows
  function createBadgeRows(badgeChunk) {
    badgeChunk.forEach((badge) => {
      badgesLoaded += 1;
      updateLoadingIndicator();

      let badgeRow = document.createElement('li');
      badgeRow.classList.add('stack-row', 'badge-row');
      badgeRow.style.opacity = '1'; // Add the opacity style

      if (badgeAnimations) {
        badgeRow.classList.add('animated');
      }

      const imageUrl = badgeImages[badge.id];

      // Create the HTML structure for each badge
      badgeRow.innerHTML = `
        <div class="badge-image">
          <a class="" href="https://www.roblox.com/badges/${
            badge.id
          }/${encodeURIComponent(badge.name)}">
            <span class="thumbnail-2d-container badge-image-container">
              <img class="" src="${imageUrl}" alt="${badge.name}" title="${
        badge.name
      }">
            </span>
          </a>
        </div>
        <div class="badge-content">
          <div class="badge-data-container">
            <div class="font-header-2 badge-name" title="${badge.name}">${
        badge.name
      }</div>
            <p class="para-overflow">${
              badge.description || '[No description available]'
            }</p>
            <div class="formatted-stats">
              <p class="para-badgestat">${(
                badge.statistics.winRatePercentage * 100
              ).toFixed(1)}% - ${getRarityLevel(
        (badge.statistics.winRatePercentage * 100).toFixed(1)
      )}</p>
              <p class="para-badgestat">${badge.statistics.awardedCount.toLocaleString()} exist</p>
            </div>
          </div>
        </div>
      `;

      // Append the badge row to the stack list
      stackList.appendChild(badgeRow);
    });
  }

  // Process badges in chunks
  for (let i = 0; i < gameBadges.length; i += chunkSize) {
    const badgeChunk = gameBadges.slice(i, i + chunkSize);
    createBadgeRows(badgeChunk);
    await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between chunks to prevent performance issues
  }
}

function createLoadingIndicator() {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'loading-indicator';

  const loadingMessage = document.createElement('span');
  loadingMessage.textContent = 'Retrieving badges...';

  const spinner = document.createElement('div');

  loadingIndicator.appendChild(spinner);
  loadingIndicator.appendChild(loadingMessage);

  document
    .querySelector('.game-badges-list')
    .parentNode.insertBefore(
      loadingIndicator,
      document.querySelector('.game-badges-list').nextSibling
    );
}

function sortBadgesByWonEver(container) {
  return new Promise((resolve, reject) => {
    try {
      let badgeRows = Array.from(container.querySelectorAll('.badge-row'));

      if (badgeRows.length === 0) {
        resolve(); // Resolve the promise if no badges to sort
        return;
      }

      badgeRows.sort((a, b) => {
        let aWonEver = getWonEverValue(a);
        let bWonEver = getWonEverValue(b);
        return bWonEver - aWonEver;
      });

      let badgeList = container.querySelector('.badge-container .stack-list');

      if (!badgeList) {
        console.error('Badge list container not found.');
        resolve(); // Resolve the promise even if the badge list container is missing
        return;
      }

      badgeRows.forEach((row) => {
        if (badgeList) {
          badgeList.appendChild(row);
        } else {
          console.error('Badge list container is missing.');
        }
      });

      resolve(); // Resolve the promise after sorting and appending badges
    } catch (error) {
      reject(error); // Reject the promise if an error occurs
    }
  });
}

function getWonEverValue(badgeRow) {
  let statsItems = badgeRow.querySelectorAll('.para-badgestat');

  for (let item of statsItems) {
    let textContent = item.textContent.trim();

    // Check if the text contains the word "exist"
    if (textContent.includes('exist')) {
      // Extract the number from the text before "exist"
      let wonEverText = textContent.split(' ')[0].replace(/,/g, '');
      return parseInt(wonEverText, 10);
    }
  }

  return 0;
}

function setTitleIfOverflow(container) {
  const elements = container.querySelectorAll('.badge-name, .para-overflow');

  elements.forEach((element) => {
    const isOverflowing = element.scrollWidth > element.clientWidth;

    if (isOverflowing) {
      element.setAttribute('title', element.textContent.trim());
    } else {
      element.removeAttribute('title');
    }
  });
}

let scrollAmount = 0;

function makeCarousel(container) {
  let badgeRows = Array.from(container.querySelectorAll('.badge-row'));

  if (badgeRows.length === 0) {
    return;
  }
  let carouselList = container.querySelector('.badge-container .stack-list');
  let scrollAmountStep = 100;
  let targetScrollAmount = 0;
  let currentScrollAmount = 0;

  chrome.storage.local.get(['scrollAmountStep'], (result) => {
    scrollAmountStep = result.scrollAmountStep || 100;

    carouselList.addEventListener('wheel', (event) => {
      event.preventDefault();

      const delta = event.deltaY > 0 ? scrollAmountStep : -scrollAmountStep;
      targetScrollAmount += delta;

      targetScrollAmount = Math.max(
        0,
        Math.min(
          targetScrollAmount,
          carouselList.scrollWidth - carouselList.clientWidth
        )
      );

      animateScroll();
    });
  });

  function animateScroll() {
    requestAnimationFrame(() => {
      currentScrollAmount += (targetScrollAmount - currentScrollAmount) * 0.1;
      carouselList.scrollLeft = currentScrollAmount;
      if (Math.abs(targetScrollAmount - currentScrollAmount) > 1) {
        animateScroll();
      }
    });
  }
}

// Badge Manager

async function fetchBadgesUntilDuplicate(userId) {
  const apiUrl = `https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Desc`;
  const storedBadges = await getStoredBadges();
  let badges = [];
  let nextPageCursor = null;

  do {
    const response = await fetch(
      `${apiUrl}${nextPageCursor ? '&cursor=' + nextPageCursor : ''}`
    );
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      for (let badge of data.data) {
        const placeId = badge.awarder.id;
        const badgeName = badge.name;

        if (
          storedBadges[placeId] &&
          storedBadges[placeId].includes(badgeName)
        ) {
          return badges;
        }

        badges.push(badge);
      }
    }

    nextPageCursor = data.nextPageCursor;
  } while (nextPageCursor);

  return badges;
}

async function updateBadges(userId) {
  const fetchedBadges = await fetchBadgesUntilDuplicate(userId);
  const storedBadges = await getStoredBadges();
  let updatedBadges = { ...storedBadges };
  const storedLength = storedBadges.length;
  let newBadgeFound = false;

  for (let badge of fetchedBadges) {
    const placeId = badge.awarder.id;
    const badgeName = badge.name.trim();

    if (!updatedBadges[placeId]) {
      updatedBadges[placeId] = [];
    }

    if (!updatedBadges[placeId].includes(badgeName)) {
      updatedBadges[placeId].push(badgeName);
      newBadgeFound = true;
    }
  }

  if (storedLength > updatedBadges.length) {
    console.log(
      `Error: Fetched badges for placeId ${placeId} are fewer than stored badges.`
    );
    newBadgeFound = false;
  }

  if (newBadgeFound) {
    await chrome.storage.local.set({ badges: updatedBadges });
  }
}

async function getBadgesByPlaceId(placeId) {
  const storedBadges = await getStoredBadges();
  return storedBadges[placeId] || [];
}

async function getStoredBadges() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['badges'], (result) => {
      resolve(result.badges || {});
    });
  });
}

async function checkAndUpdateBadges(userId) {
  await updateBadges(userId);
}

async function getBadgesForPlace(placeId) {
  const badges = await getBadgesByPlaceId(placeId);
  console.log(`Badges for Place ID ${placeId}:`, badges);
  return badges;
}
