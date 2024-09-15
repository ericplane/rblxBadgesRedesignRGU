let badgesLoaded = 0;
let totalBadges = 0;

window.addEventListener('load', function () {
  console.log('Page fully loaded, including other extensions.');

  let checkForBadgeContainer = setInterval(function () {
    let badgeContainer = document.querySelector('.game-badges-list');
    if (badgeContainer) {
      clearInterval(checkForBadgeContainer);
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
  await getBadges();
  document.querySelector(
    '#loading-indicator span'
  ).textContent = `Fetching user badges... (First time this runs it may take a while)`;
  await updateBadgeStorage();
  await clickUntilGone(ownedContainer, '.btn-control-md');
  document.querySelector(
    '#loading-indicator span'
  ).textContent = `Organzing badges... (${badgesLoaded}/${totalBadges})`;
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
      //sortBadgesByWonEver(notOwnedContainer);

      document.querySelector(
        '#loading-indicator span'
      ).textContent = `Formatting badges... (${badgesLoaded}/${totalBadges})`;

      formatBadgeRow(ownedContainer);
      formatBadgeRow(notOwnedContainer);
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
  const notOwnedList = notOwnedContainer.querySelector('.stack-list');
  const badgeRows = Array.from(ownedContainer.querySelectorAll('.badge-row'));
  let index = 0;
  const url = new URL(window.location.href);
  const placeId = url.pathname.split('/')[2];

  // Function to get badge names for the given placeId
  async function getBadgesForPlace(placeId) {
    // Implement your logic to get badges from local storage
    // This should return a list of badge names for the placeId
    return new Promise((resolve) => {
      chrome.storage.local.get(['badges'], (result) => {
        const badges = result.badges || {};
        resolve(badges[placeId] || []);
      });
    });
  }

  // Function to move a batch of badges
  function moveNextBatch() {
    const batchSize = 50; // Adjust batch size to avoid freezing the browser

    // Set opacity to 0.5 for all badge rows
    for (let i = 0; i < batchSize && index < badgeRows.length; i++, index++) {
      const row = badgeRows[index];
      row.style.opacity = '0.5';
    }

    // Check ownership of badges and adjust opacity
    getBadgesForPlace(placeId).then((badgeNames) => {
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

    do {
      const badgesResponse = await fetch(
        `https://badges.roblox.com/v1/universes/${universeId}/badges?limit=${pageSize}${
          nextPageCursor ? `&cursor=${nextPageCursor}` : ''
        }`
      );
      const badgesData = await badgesResponse.json();

      totalBadges += badgesData.data.length;
      nextPageCursor = badgesData.nextPageCursor;
    } while (nextPageCursor);

    console.log(`Total badges: ${totalBadges}`);
    return totalBadges;
  } catch (error) {
    console.error('Error fetching badges:', error);
    throw error;
  }
}

function createLoadingIndicator() {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.id = 'loading-indicator';

  const loadingMessage = document.createElement('span');
  loadingMessage.textContent = 'Loading badges...';

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

function clickUntilGone(element, buttonSelector) {
  return new Promise((resolve) => {
    let clickInterval;
    let lastClickedTime = 0;
    const throttleTime = 2000;

    function clickHandler() {
      const now = Date.now();
      let seeMoreButton = element.querySelector(buttonSelector);

      if (seeMoreButton && seeMoreButton.offsetParent !== null) {
        if (now - lastClickedTime >= throttleTime) {
          console.log('See More button is visible, clicking...');
          seeMoreButton.click();
          lastClickedTime = now;

          badgesLoaded =
            document.querySelector('.stack-list').childElementCount;
          document.querySelector(
            '#loading-indicator span'
          ).textContent = `Loading badges... (${badgesLoaded}/${totalBadges})`;
        }
      } else {
        console.log('See More button no longer visible.');
        clearInterval(clickInterval);
        resolve();
      }
    }

    clickInterval = setInterval(() => {
      requestAnimationFrame(clickHandler);
    }, throttleTime);
  });
}

function copyBadgeStatsInfo(originalContainer, clonedContainer) {
  let originalStatsItems = originalContainer.querySelectorAll(
    '.badge-stats-container li'
  );
  let clonedStatsItems = clonedContainer.querySelectorAll(
    '.badge-stats-container li'
  );

  originalStatsItems.forEach((originalItem, index) => {
    let originalText = originalItem
      .querySelector('.badge-stats-info')
      .textContent.trim();

    if (clonedStatsItems[index]) {
      let clonedTextElement =
        clonedStatsItems[index].querySelector('.badge-stats-info');

      if (clonedTextElement) {
        if (originalText.includes('Unclaimed')) {
          let numberPart = originalText.split('Unclaimed')[0];
          clonedTextElement.innerHTML = `${numberPart} <div class="text-unclaimed">Unclaimed</div>`;
        } else if (originalText.includes('Claimed')) {
          let numberPart = originalText.split('Claimed')[0];
          clonedTextElement.innerHTML = `${numberPart} <div class="text-claimed" title="${originalText}">Claimed</div>`;
          clonedTextElement.style.color = '#FFDC64'; // Apply color
        } else {
          let words = originalText.split(' ');
          if (words.length === 2) {
            clonedTextElement.innerHTML = `${words[0]} <div class="text-rarity">${words[1]}</div>`;
          } else {
            clonedTextElement.textContent = originalText;
          }
        }
      }
    }
  });
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

      let badgeList = container.querySelector('.stack-list');

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
  let statsItems = badgeRow.querySelectorAll('.badge-stats-container li');

  for (let item of statsItems) {
    let label = item.querySelector('.text-label').textContent.trim();
    if (label === 'Won Ever') {
      let wonEverElement = item.querySelector('.badge-stats-info');
      if (wonEverElement) {
        let wonEverText = wonEverElement.textContent.replace(/,/g, '');
        return parseInt(wonEverText, 10);
      }
    }
  }

  return 0;
}

function extractBadgeStats(element) {
  if (!element) {
    console.error('No element provided.');
    return;
  }

  let rarity = '';
  let rarityType = '';
  let wonEver = '';
  let status = '';

  const listItems = element.querySelectorAll('li');

  listItems.forEach((item) => {
    const label = item.querySelector('.text-label');
    const info = item.querySelector('.font-header-2.badge-stats-info');

    if (label && info) {
      switch (label.textContent.trim()) {
        case 'Rarity':
          rarity = info.textContent.trim().split(' ')[0];
          rarityType = info.querySelector('.text-rarity')
            ? info.querySelector('.text-rarity').textContent.trim()
            : '';
          break;
        case 'Won Ever':
          wonEver = info.textContent.trim();
          break;
      }
    }

    const badgeInfo = item.querySelector('.font-header-2.badge-stats-info');
    if (badgeInfo) {
      const statusElement =
        badgeInfo.querySelector('.text-unclaimed') ||
        badgeInfo.querySelector('.text-claimed');
      if (statusElement) {
        status = statusElement.textContent.trim();
      }
    }
  });

  return {
    rarity,
    rarityType,
    wonEver,
    status,
  };
}

function formatBadgeRow(container) {
  let badgeRows = Array.from(container.querySelectorAll('.badge-row'));

  if (badgeRows.length === 0) {
    return;
  }

  badgeRows.forEach((row) => {
    let badgeStats = extractBadgeStats(
      row.querySelector('.badge-stats-container')
    );
    let badgeDetails = row.querySelector('.badge-data-container');

    if (badgeStats) {
      let rarityText = badgeStats.rarity;
      let rarityTypeText = badgeStats.rarityType;
      let wonEverText = badgeStats.wonEver;
      let statusText = badgeStats.status;

      let formattedStatsElement = document.createElement('div');
      formattedStatsElement.classList.add('formatted-stats');

      formattedStatsElement.innerHTML = `
        <p class="para-badgestat">${rarityText} - ${rarityTypeText}</p>
        <p class="para-badgestat">${wonEverText} exist</p>
        ${statusText ? `<p class="para-badgestat">${statusText}</p>` : ''}
      `;

      badgeDetails.insertBefore(formattedStatsElement, badgeDetails.lastChild);

      row.querySelector('.badge-stats-container').remove();
    }
  });
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
  let carouselList = container.querySelector('.stack-list');
  const scrollAmountStep = 100;

  let targetScrollAmount = 0;
  let currentScrollAmount = 0;

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
  let updatedBadges = {};
  let newBadgeFound = false;

  for (let badge of fetchedBadges) {
    const placeId = badge.awarder.id;
    const badgeName = badge.name;

    if (!storedBadges[placeId]) {
      storedBadges[placeId] = [];
    }

    if (!storedBadges[placeId].includes(badgeName)) {
      storedBadges[placeId].push(badgeName);
      newBadgeFound = true;
    }

    updatedBadges[placeId] = storedBadges[placeId];
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
}
