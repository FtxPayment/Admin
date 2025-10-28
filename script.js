(function () {
  'use strict';

  // DOM references
  const multiplierEl = document.getElementById('multiplier');
  const crashTextEl = document.getElementById('crash-text');
  const roundStatusEl = document.getElementById('round-status');
  const nextRoundEl = document.getElementById('next-round');
  const countdownEl = document.getElementById('countdown');

  const balanceEl = document.getElementById('balance');
  const betAmountInput = document.getElementById('bet-amount');
  const quickButtons = document.querySelectorAll('[data-quick]');
  const startBetBtn = document.getElementById('start-bet');
  const withdrawBtn = document.getElementById('withdraw');
  const repeatBetBtn = document.getElementById('repeat-bet');
  const betNoteEl = document.getElementById('bet-note');
  const autoWithdrawCheckbox = document.getElementById('auto-withdraw-enabled');
  const autoWithdrawInput = document.getElementById('auto-withdraw');

  const playersBody = document.getElementById('players-body');

  // Game State
  const ROUND_STATE = {
    WAITING: 'WAITING',
    RUNNING: 'RUNNING',
    CRASHED: 'CRASHED',
    COUNTDOWN: 'COUNTDOWN',
  };
  let roundState = ROUND_STATE.WAITING;
  let currentMultiplier = 1.0;
  let crashPoint = 0;
  let lastTimestamp = 0;
  let rafId = null;
  let countdownTimerId = null;
  let countdownRemaining = 5;

  // Betting State
  let userBalance = 1000000; // Rp
  let userHasActiveBet = false;
  let userBetAmount = 0;
  let lastBetAmount = 0;
  let userHasWithdrawnThisRound = false;
  let userAutoWithdrawEnabled = false;
  let userAutoWithdrawAt = 2.0;

  // Dummy players
  const usernames = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Intan', 'Joko'];
  /** @type {Array<{username:string, bet:number, status:'bet'|'withdraw'|'crash', cashoutAt?:number}>} */
  let activePlayers = [];

  function formatRupiah(number) {
    return 'Rp ' + number.toLocaleString('id-ID');
  }

  function updateBalanceUi() {
    balanceEl.textContent = formatRupiah(userBalance);
  }

  function setMultiplierColor(mult) {
    multiplierEl.classList.remove('level-green', 'level-yellow', 'level-red');
    if (mult < 2) multiplierEl.classList.add('level-green');
    else if (mult < 4) multiplierEl.classList.add('level-yellow');
    else multiplierEl.classList.add('level-red');
  }

  function setUiForState(state) {
    switch (state) {
      case ROUND_STATE.WAITING:
        roundStatusEl.textContent = 'Ronde akan dimulai';
        startBetBtn.disabled = false;
        withdrawBtn.disabled = true;
        nextRoundEl.classList.add('hidden');
        crashTextEl.classList.add('hidden');
        break;
      case ROUND_STATE.RUNNING:
        roundStatusEl.textContent = 'Ronde berjalan';
        startBetBtn.disabled = true;
        withdrawBtn.disabled = !userHasActiveBet || userHasWithdrawnThisRound;
        nextRoundEl.classList.add('hidden');
        crashTextEl.classList.add('hidden');
        break;
      case ROUND_STATE.CRASHED:
        roundStatusEl.textContent = 'Ronde crash';
        startBetBtn.disabled = true;
        withdrawBtn.disabled = true;
        nextRoundEl.classList.remove('hidden');
        crashTextEl.classList.remove('hidden');
        break;
      case ROUND_STATE.COUNTDOWN:
        roundStatusEl.textContent = 'Menunggu ronde baru';
        startBetBtn.disabled = true;
        withdrawBtn.disabled = true;
        nextRoundEl.classList.remove('hidden');
        break;
    }
  }

  function resetForNewRound() {
    roundState = ROUND_STATE.WAITING;
    currentMultiplier = 1.0;
    crashPoint = randomCrashPoint();
    userHasWithdrawnThisRound = false;

    multiplierEl.textContent = currentMultiplier.toFixed(2) + 'x';
    setMultiplierColor(currentMultiplier);
    multiplierEl.style.transform = 'scale(1)';
    crashTextEl.classList.add('hidden');

    // generate dummy players for the round (random subset)
    activePlayers = generateDummyPlayers();
    renderPlayers();

    setUiForState(ROUND_STATE.WAITING);

    // Brief waiting then start automatically so it's global loop
    setTimeout(() => startRound(), 800);
  }

  function randomCrashPoint() {
    // Random between 1.5 and 10.0, but skew so lower crashes are more common
    const min = 1.5; const max = 10.0;
    // skew using exponential-like distribution
    const r = Math.random();
    const skew = Math.pow(r, 1.6); // more weight to small values
    return parseFloat((min + (max - min) * skew).toFixed(2));
  }

  function generateDummyPlayers() {
    const count = Math.floor(Math.random() * 6) + 5; // 5-10 players
    const players = [];
    const usedIndexes = new Set();
    for (let i = 0; i < count; i++) {
      let idx;
      do { idx = Math.floor(Math.random() * usernames.length); } while (usedIndexes.has(idx));
      usedIndexes.add(idx);
      const bet = (Math.floor(Math.random() * 9) + 2) * 10000; // 20k - 100k
      players.push({ username: usernames[idx], bet, status: 'bet' });
    }
    return players;
  }

  function renderPlayers() {
    playersBody.innerHTML = '';
    for (const p of activePlayers) {
      const tr = document.createElement('tr');
      const statusText = p.status === 'bet' ? 'Menunggu' : p.status === 'withdraw' ? `Withdraw @ ${p.cashoutAt?.toFixed(2)}x` : 'Crash';
      const statusClass = p.status === 'withdraw' ? 'status-withdraw' : p.status === 'crash' ? 'status-crash' : '';
      tr.innerHTML = `
        <td>${p.username}</td>
        <td>${formatRupiah(p.bet)}</td>
        <td class="${statusClass}">${statusText}</td>
      `;
      playersBody.appendChild(tr);
    }
  }

  // Dummy players auto-cashout behavior during RUNNING
  function simulatePlayersDuringRun(mult) {
    for (const p of activePlayers) {
      if (p.status !== 'bet') continue;
      // probability to cash out increases with multiplier
      const base = 0.0025; // initial low chance per frame
      const chance = base * Math.pow(mult, 1.2);
      if (Math.random() < chance) {
        p.status = 'withdraw';
        p.cashoutAt = mult;
      }
    }
    renderPlayers();
  }

  function startRound() {
    roundState = ROUND_STATE.RUNNING;
    setUiForState(roundState);
    lastTimestamp = performance.now();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - lastTimestamp) / 1000); // seconds, clamp to avoid huge jumps
    lastTimestamp = now;

    // exponential growth: m = 1 * e^(k * t). Here we approximate by multiplying per frame.
    // compute growth factor based on current multiplier to create accelerating feel.
    const growthRate = 0.04 + Math.min(0.18, currentMultiplier * 0.006);
    currentMultiplier *= 1 + growthRate * dt * 12; // scaled for feel

    // Visuals
    multiplierEl.textContent = currentMultiplier.toFixed(2) + 'x';
    setMultiplierColor(currentMultiplier);
    const scale = 1 + Math.min(0.25, Math.log10(Math.max(1.01, currentMultiplier)) * 0.15);
    multiplierEl.style.transform = `scale(${scale.toFixed(3)})`;

    // Simulate players cashing out
    simulatePlayersDuringRun(currentMultiplier);

    // Auto-withdraw for user
    if (userHasActiveBet && !userHasWithdrawnThisRound && userAutoWithdrawEnabled && currentMultiplier >= userAutoWithdrawAt) {
      performWithdraw('Auto withdraw tercapai');
    }

    // User withdraw button state
    withdrawBtn.disabled = !userHasActiveBet || userHasWithdrawnThisRound;

    if (currentMultiplier >= crashPoint) {
      handleCrash();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function handleCrash() {
    roundState = ROUND_STATE.CRASHED;
    if (rafId) cancelAnimationFrame(rafId);

    multiplierEl.textContent = crashPoint.toFixed(2) + 'x';
    setMultiplierColor(crashPoint);
    crashTextEl.textContent = `CRASHED @ ${crashPoint.toFixed(2)}x`;
    crashTextEl.classList.remove('hidden');
    multiplierEl.style.transform = 'scale(1)';

    // Any players still in 'bet' status are crashed
    for (const p of activePlayers) {
      if (p.status === 'bet') p.status = 'crash';
    }
    renderPlayers();

    // If user didn't withdraw in time, they crash
    if (userHasActiveBet && !userHasWithdrawnThisRound) {
      betNoteEl.textContent = 'Bet anda crash. Coba lagi di ronde berikutnya.';
      userHasActiveBet = false; // lost bet
    }

    // Begin countdown to next round
    beginCountdown();
  }

  function beginCountdown() {
    roundState = ROUND_STATE.COUNTDOWN;
    countdownRemaining = 5;
    countdownEl.textContent = String(countdownRemaining);
    setUiForState(roundState);
    if (countdownTimerId) clearInterval(countdownTimerId);
    countdownTimerId = setInterval(() => {
      countdownRemaining -= 1;
      countdownEl.textContent = String(countdownRemaining);
      if (countdownRemaining <= 0) {
        clearInterval(countdownTimerId);
        resetForNewRound();
      }
    }, 1000);
  }

  // Betting interactions
  function onStartBet() {
    const amount = parseInt(betAmountInput.value || '0', 10) || 0;
    if (amount < 1000) {
      betNoteEl.textContent = 'Minimal bet Rp 1.000';
      return;
    }
    if (amount > userBalance) {
      betNoteEl.textContent = 'Saldo tidak cukup';
      return;
    }
    if (roundState !== ROUND_STATE.WAITING) {
      betNoteEl.textContent = 'Bet hanya sebelum ronde mulai';
      return;
    }

    userBalance -= amount;
    updateBalanceUi();

    userHasActiveBet = true;
    userBetAmount = amount;
    lastBetAmount = amount;
    betNoteEl.textContent = `Bet dipasang: ${formatRupiah(amount)}`;

    // Add user to players table as 'You'
    activePlayers.unshift({ username: 'You', bet: amount, status: 'bet' });
    renderPlayers();
  }

  function performWithdraw(message) {
    if (!userHasActiveBet || userHasWithdrawnThisRound) return;
    const cashMultiplier = Math.max(1.0, Math.min(currentMultiplier, crashPoint || currentMultiplier));
    const payout = Math.floor(userBetAmount * cashMultiplier);
    userBalance += payout;
    updateBalanceUi();
    userHasWithdrawnThisRound = true;
    userHasActiveBet = false;
    betNoteEl.textContent = `${message || 'Withdraw berhasil'} @ ${cashMultiplier.toFixed(2)}x → ${formatRupiah(payout)}`;

    // Update user row in players table
    const you = activePlayers.find(p => p.username === 'You' && p.status === 'bet');
    if (you) {
      you.status = 'withdraw';
      you.cashoutAt = cashMultiplier;
    } else {
      // If already inserted earlier, ensure we have a withdrawn record
      activePlayers.unshift({ username: 'You', bet: userBetAmount, status: 'withdraw', cashoutAt: cashMultiplier });
    }
    renderPlayers();
  }

  function onWithdraw() {
    if (roundState !== ROUND_STATE.RUNNING) return;
    performWithdraw('Withdraw manual');
  }

  function onRepeatBet() {
    if (lastBetAmount <= 0) {
      betNoteEl.textContent = 'Belum ada bet sebelumnya';
      return;
    }
    betAmountInput.value = String(lastBetAmount);
    betNoteEl.textContent = 'Nominal diisi dari bet terakhir';
  }

  // Event listeners
  startBetBtn.addEventListener('click', onStartBet);
  withdrawBtn.addEventListener('click', onWithdraw);
  repeatBetBtn.addEventListener('click', onRepeatBet);
  quickButtons.forEach(btn => btn.addEventListener('click', () => {
    const amt = parseInt(btn.getAttribute('data-quick') || '0', 10);
    betAmountInput.value = String(amt);
  }));
  autoWithdrawCheckbox.addEventListener('change', () => {
    userAutoWithdrawEnabled = autoWithdrawCheckbox.checked;
  });
  autoWithdrawInput.addEventListener('change', () => {
    const v = parseFloat(autoWithdrawInput.value || '2.0');
    userAutoWithdrawAt = isNaN(v) ? 2.0 : Math.max(1.1, v);
    autoWithdrawInput.value = userAutoWithdrawAt.toFixed(2);
  });

  // Initialize
  updateBalanceUi();
  autoWithdrawInput.dispatchEvent(new Event('change'));
  setUiForState(ROUND_STATE.WAITING);
  resetForNewRound();
})();

