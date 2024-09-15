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
  await clickUntilGone(ownedContainer, '.btn-control-md');
  let notOwnedContainer = ownedContainer.cloneNode(true);

  ownedContainer.parentNode.insertBefore(
    notOwnedContainer,
    ownedContainer.nextSibling
  );

  setTimeout(() => {
    copyBadgeStatsInfo(ownedContainer, notOwnedContainer);

    ownedContainer.getElementsByClassName('container-header')[0].innerHTML =
      '<h2>Unlocked Badges</h2>';
    notOwnedContainer.getElementsByClassName('container-header')[0].innerHTML =
      '<h2>Locked Badges</h2>';

    filterBadgeRows(ownedContainer, notOwnedContainer);

    setTimeout(() => {
      sortBadgesByWonEver(ownedContainer);
      sortBadgesByWonEver(notOwnedContainer);

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

function filterBadgeRows(ownedContainer, notOwnedContainer) {
  let ownedBadgeRows = ownedContainer.querySelectorAll('.badge-row');
  ownedBadgeRows.forEach((row) => {
    if (window.getComputedStyle(row).opacity === '0.5') {
      row.remove();
    }
  });

  let notOwnedBadgeRows = notOwnedContainer.querySelectorAll('.badge-row');
  notOwnedBadgeRows.forEach((row) => {
    if (window.getComputedStyle(row).opacity === '1') {
      row.remove();
    }
  });
}

function clickUntilGone(element, buttonSelector) {
  return new Promise((resolve) => {
    let clickInterval = setInterval(() => {
      let seeMoreButton = element.querySelector(buttonSelector);

      if (seeMoreButton && seeMoreButton.offsetParent !== null) {
        console.log('See More button is visible, clicking...');
        seeMoreButton.click();
        badgesLoaded = document.querySelector('.stack-list').childElementCount;
        document.querySelector(
          '#loading-indicator span'
        ).textContent = `Loading badges... (${badgesLoaded}/${totalBadges})`;
      } else {
        console.log('See More button no longer visible.');
        clearInterval(clickInterval);
        resolve();
      }
    }, 1000);
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
  let badgeRows = Array.from(container.querySelectorAll('.badge-row'));

  if (badgeRows.length === 0) {
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
    return;
  }

  badgeRows.forEach((row) => {
    if (badgeList) {
      badgeList.appendChild(row);
    } else {
      console.error('Badge list container is missing.');
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
