/**
 * VocabMaster - Main Application Logic
 * Structure:
 * 1. State Management (Store)
 * 2. Data & Storage Services
 * 3. UI Controller (DOM Manipulation)
 * 4. Initialization
 */

(function () {
  'use strict';

  // --- 1. CONFIG & STATE ---
  const CONFIG = {
    files: {
      "500 Most Repeated (SSC)": "Most_Repeated.json",
      "SSC One-Word Substitution": "SSC_one_word_substitution.json",
      "The Hindu Vocabulary": "The_hindu_vocabulary.json",
      "List of Phobias": "List_of_Phobia.json",
      "List of Manias": "List_of_Mania.json",
      "List of Philes": "List_of_Phile.json",
      "Killing / Age / Place": "Words_For.json",
      "Branches of Study": "Branch_of_study.json",
      "Forms of Govt & Worship": "Form_of_gov_worship.json",
      "Literary & Foreign Words": "literacy.json",
      "English Root Words": "english_root_word.json"
    }
  };

  const store = {
    state: {
      currentView: 'home',
      theme: localStorage.getItem('theme') || 'light',
      categories: CONFIG.files,
      currentCategoryName: null,
      words: [], // Current active word list
      currentIndex: 0,
      shuffledIndices: [],
      isFlipped: false,
      favorites: JSON.parse(localStorage.getItem('favorites')) || [],
      streak: parseInt(localStorage.getItem('streak')) || 0,
      lastVisit: localStorage.getItem('lastVisit') || null
    },

    // Simple Pub/Sub for Reactivity
    listeners: [],
    subscribe(fn) { this.listeners.push(fn); },
    notify() { this.listeners.forEach(fn => fn(this.state)); },

    // Actions
    setTheme(theme) {
      this.state.theme = theme;
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      this.notify();
    },

    toggleFavorite(wordObj) {
      const idx = this.state.favorites.findIndex(w => w.word === wordObj.word);
      if (idx === -1) {
        this.state.favorites.push(wordObj);
      } else {
        this.state.favorites.splice(idx, 1);
      }
      localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
      this.notify();
    },

    checkStreak() {
      const today = new Date().toDateString();
      if (this.state.lastVisit !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (this.state.lastVisit === yesterday.toDateString()) {
          this.state.streak++;
        } else {
          this.state.streak = 1; // Reset if broken or first time
        }
        this.state.lastVisit = today;
        localStorage.setItem('lastVisit', today);
        localStorage.setItem('streak', this.state.streak);
      }
    },

    // Quiz Logic
    quiz: {
      currentQuestion: null,
      score: 0,
      isAnswering: false
    }
  };

  // --- 2. SERVICES ---
  const DataService = {
    cache: {},
    async fetchCategory(filename) {
      if (this.cache[filename]) return this.cache[filename];
      try {
        // Determine base path - handling GitHub Pages vs Local
        const path = `data/${filename}`;
        console.log(`Fetching from: ${path}`);

        const res = await fetch(path);

        if (!res.ok) {
          throw new Error(`Status ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        this.cache[filename] = data;
        return data;
      } catch (err) {
        console.error("Data Load Error:", err);
        // More helpful error message
        let msg = `Could not load ${filename}.`;
        if (window.location.protocol === 'file:') {
          msg += "\n\nNOTE: Browsers block reading local files (CORS). Please use a local server (e.g., VS Code Live Server) or deploy to GitHub.";
        } else {
          msg += `\nError: ${err.message}`;
        }
        alert(msg);
        return [];
      }
    },

    generateQuizOptions(correctWord, allWords, count = 4) {
      const options = [correctWord];
      const distractorPool = allWords.filter(w => w.word !== correctWord.word);

      // Randomly select distractors
      for (let i = 0; i < count - 1; i++) {
        if (distractorPool.length === 0) break;
        const r = Math.floor(Math.random() * distractorPool.length);
        options.push(distractorPool.splice(r, 1)[0]);
      }

      // Shuffle options
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }
      return options;
    }
  };

  // --- 3. UI CONTROLLER ---
  const UI = {
    elements: {
      app: document.querySelector('.app-container'),
      views: document.querySelectorAll('.view'),
      navItems: document.querySelectorAll('.nav-item'),
      themeToggle: document.getElementById('themeToggle'),
      streakCount: document.getElementById('streakCount'),
      categoryGrid: document.getElementById('categoryGrid'),

      // Study View
      studyCategoryTitle: document.getElementById('studyCategoryTitle'),
      currentIndex: document.getElementById('currentIndex'),
      totalIndex: document.getElementById('totalIndex'),
      flashcard: document.getElementById('flashcard'),
      cardWord: document.getElementById('cardWord'),
      cardMeaning: document.getElementById('cardMeaning'),
      nextBtn: document.getElementById('nextBtn'),
      prevBtn: document.getElementById('prevBtn'),
      shuffleBtn: document.getElementById('shuffleBtn'),
      favBtn: document.getElementById('favBtn'),
      speakBtn: document.getElementById('speakBtn'),

      // Search View
      searchInput: document.getElementById('searchInput'),
      resultsList: document.getElementById('resultsList'),
      searchTabs: document.querySelectorAll('.filter-tabs .tab'),

      // Quiz View
      quizQuestion: document.getElementById('quizQuestion'),
      quizOptions: document.getElementById('quizOptions'),
      quizScore: document.getElementById('quizScore'),
      quizFeedback: document.getElementById('quizFeedback'),
      feedbackIcon: document.getElementById('feedbackIcon'),
      feedbackText: document.getElementById('feedbackText'),
      nextQuestionBtn: document.getElementById('nextQuestionBtn')
    },

    init() {
      this.bindEvents();
      this.renderHome();
      store.setTheme(store.state.theme);
      store.checkStreak();
      this.updateHeader();
    },

    bindEvents() {
      // Navigation
      document.querySelectorAll('[data-target]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const target = e.currentTarget.dataset.target;
          this.switchView(target);
        });
      });

      // Theme Toggle
      this.elements.themeToggle.addEventListener('click', () => {
        const newTheme = store.state.theme === 'light' ? 'dark' : 'light';
        store.setTheme(newTheme);
      });

      // Flashcard
      this.elements.flashcard.addEventListener('click', () => {
        this.elements.flashcard.classList.toggle('flipped');
      });

      this.elements.nextBtn.addEventListener('click', () => this.navigateCard(1));
      this.elements.prevBtn.addEventListener('click', () => this.navigateCard(-1));

      this.elements.shuffleBtn.addEventListener('click', () => {
        this.shuffleCurrentDeck();
        this.loadCard(0);
      });

      this.elements.speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pronounceWord();
      });

      this.elements.favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = store.state.words[store.state.shuffledIndices[store.state.currentIndex]];
        store.toggleFavorite(word);
        this.updateFavIcon(word);
      });

      // Search
      this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
      this.elements.searchTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          this.elements.searchTabs.forEach(t => t.classList.remove('active'));
          e.target.classList.add('active');
          this.handleSearch(this.elements.searchInput.value, e.target.dataset.filter);
        });
      });

      // Go home btn
      document.getElementById('goHomeBtn').addEventListener('click', () => this.switchView('homeView'));

      // Quiz
      document.getElementById('startQuizBtn').addEventListener('click', () => this.startQuiz());
      this.elements.nextQuestionBtn.addEventListener('click', () => this.nextQuizQuestion());
    },

    switchView(viewId) {
      this.elements.views.forEach(v => {
        v.classList.add('hidden');
        v.classList.remove('active');
      });
      document.getElementById(viewId).classList.remove('hidden');
      setTimeout(() => document.getElementById(viewId).classList.add('active'), 10);

      // Update Bottom Nav
      this.elements.navItems.forEach(item => {
        if (item.dataset.target === viewId) item.classList.add('active');
        else item.classList.remove('active');
      });

      if (viewId === 'listView') {
        this.handleSearch('');
      }
    },

    renderHome() {
      const grid = this.elements.categoryGrid;
      grid.innerHTML = '';

      Object.entries(store.state.categories).forEach(([name, file]) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
                    <div class="cat-icon">${this.getIconForCategory(name)}</div>
                    <div class="cat-name">${name}</div>
                    <div class="cat-count">Flashcards</div>
                `;
        card.addEventListener('click', () => this.showModeSelection(name, file));
        grid.appendChild(card);
      });
    },

    showModeSelection(name, file) {
      // Simple prompt or modal could go here, for now directly to Flashcard vs Quiz?
      // Let's add little pill buttons on the card directly or show a modal. 
      // For MVP upgrade: Let's default to Flashcard but add a "Start Quiz" button in Study View?
      // OR: Let's make the card click show a simple modal (browser alert for now is ugly).
      // Better: Add "Practice Mode" and "Quiz Mode" buttons to the home view? No space.
      // Let's modify startSession to accept a mode.

      // New UX: Click category -> Opens Study View. Study View has a "Take Quiz" button.
      this.startSession(name, file, 'study');
    },

    getIconForCategory(name) {
      if (name.includes("Phobia")) return "😱";
      if (name.includes("Mania")) return "🤯";
      if (name.includes("Government")) return "🏛️";
      if (name.includes("Root")) return "🌱";
      if (name.includes("Hindu")) return "📰";
      if (name.includes("SSC")) return "✍️";
      return "📚";
    },

    async startSession(name, filename, mode = 'study') {
      const data = await DataService.fetchCategory(filename);
      store.state.words = data;
      store.state.currentCategoryName = name;
      store.state.shuffledIndices = data.map((_, i) => i);
      store.state.currentIndex = 0;

      if (mode === 'quiz') {
        this.startQuiz();
      } else {
        this.elements.studyCategoryTitle.textContent = name;
        this.elements.totalIndex.textContent = data.length;
        this.switchView('studyView');
        this.loadCard(0);


      }
    },

    // --- FLASHCARD METHODS ---
    loadCard(index) {
      if (index < 0 || index >= store.state.words.length) return;
      store.state.currentIndex = index;

      const realIndex = store.state.shuffledIndices[index];
      const item = store.state.words[realIndex];

      this.elements.cardWord.textContent = item.word;
      this.elements.cardMeaning.textContent = item.meaning;
      this.elements.currentIndex.textContent = `${index + 1}`;

      this.elements.flashcard.classList.remove('flipped');
      this.updateFavIcon(item);
    },

    navigateCard(direction) {
      const newIndex = store.state.currentIndex + direction;
      if (newIndex >= 0 && newIndex < store.state.words.length) {
        this.loadCard(newIndex);
      }
    },

    shuffleCurrentDeck() {
      const arr = store.state.shuffledIndices;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    },

    pronounceWord() {
      const word = this.elements.cardWord.textContent;
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    },

    updateFavIcon(item) {
      const isFav = store.state.favorites.some(f => f.word === item.word);
      this.elements.favBtn.textContent = isFav ? "❤️" : "🤍";
      this.elements.favBtn.style.color = isFav ? "var(--accent)" : "var(--text)";
    },

    // --- QUIZ METHODS ---
    startQuiz() {
      store.quiz.score = 0;
      this.elements.quizScore.textContent = 0;
      this.switchView('quizView');
      this.nextQuizQuestion();
    },

    nextQuizQuestion() {
      this.elements.quizFeedback.classList.add('hidden');
      store.quiz.isAnswering = true;

      // Pick random word
      const words = store.state.words;
      const randIdx = Math.floor(Math.random() * words.length);
      const questionItem = words[randIdx];
      store.quiz.currentQuestion = questionItem;

      // Generate Options
      const options = DataService.generateQuizOptions(questionItem, words);

      // Render
      this.elements.quizQuestion.textContent = questionItem.meaning; // Question is Meaning
      this.elements.quizOptions.innerHTML = '';

      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt.word;
        btn.onclick = () => this.handleQuizAnswer(btn, opt);
        this.elements.quizOptions.appendChild(btn);
      });
    },

    handleQuizAnswer(btn, selectedOption) {
      if (!store.quiz.isAnswering) return;
      store.quiz.isAnswering = false;

      const isCorrect = selectedOption.word === store.quiz.currentQuestion.word;

      if (isCorrect) {
        btn.classList.add('correct');
        store.quiz.score += 10;
        this.elements.quizScore.textContent = store.quiz.score;
        this.showFeedback(true);
      } else {
        btn.classList.add('wrong');
        // Highlight correct one
        const correctBtn = Array.from(this.elements.quizOptions.children).find(
          b => b.textContent === store.quiz.currentQuestion.word
        );
        if (correctBtn) correctBtn.classList.add('correct');
        this.showFeedback(false);
      }
    },

    showFeedback(isCorrect) {
      this.elements.feedbackIcon.textContent = isCorrect ? "🎉" : "😢";
      this.elements.feedbackText.textContent = isCorrect ? "Correct!" : `Wrong! It was "${store.quiz.currentQuestion.word}"`;
      this.elements.quizFeedback.classList.remove('hidden');
    },

    updateHeader() {
      this.elements.streakCount.textContent = store.state.streak;
    },

    handleSearch(query, filter = null) {
      if (!filter) {
        const activeTab = document.querySelector('.filter-tabs .tab.active');
        filter = activeTab ? activeTab.dataset.filter : 'all';
      }

      let source = [];
      if (filter === 'favorites') {
        source = store.state.favorites;
      } else {
        // Combine current words + favorites + maybe others?
        // For now, load Favorites + Current Session Words (if any)
        source = [...store.state.favorites];
        if (store.state.words.length > 0) {
          // Deduplicate
          const favWords = new Set(source.map(w => w.word));
          store.state.words.forEach(w => {
            if (!favWords.has(w.word)) source.push(w);
          });
        }
      }

      const results = source.filter(item =>
        item.word.toLowerCase().includes(query.toLowerCase()) ||
        item.meaning.toLowerCase().includes(query.toLowerCase())
      );

      this.renderList(results);
    },

    renderList(items) {
      const container = this.elements.resultsList;
      container.innerHTML = '';

      if (items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">No items found. Try opening a category first.</div>';
        return;
      }

      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `<h4>${item.word}</h4><p>${item.meaning}</p>`;
        container.appendChild(el);
      });
    }
  };

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    UI.init();
  });

})();
