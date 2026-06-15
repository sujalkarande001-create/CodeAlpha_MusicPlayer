/*
  CodeAlpha Music Player - Full Working script.js
  Keep audio.mp3 in the same folder as index.html and script.js
*/

(() => {
    const PLAYLIST = [{
            id: "song-1",
            title: "My Audio Track",
            artist: "CodeAlpha",
            src: "audio.mp3",
            image: "https://flxt.tmsimg.com/assets/p10045117_p_v10_ab.jpg"
        },
        {
            id: "song-2",
            title: "Demo Track 2",
            artist: "Demo",
            src: "https://www2.cs.uic.edu/~i101/SoundFiles/gettysburg10.wav",
            image: "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=512&q=80"
        },
        {
            id: "song-3",
            title: "Demo Track 3",
            artist: "Demo",
            src: "https://www2.cs.uic.edu/~i101/SoundFiles/PinkPanther30.wav",
            image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=512&q=80"
        }
    ];

    const audio = document.getElementById("audio");
    const playlistEl = document.getElementById("playlist");
    const playBtn = document.getElementById("playBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const trackTitleEl = document.getElementById("trackTitle");
    const trackArtistEl = document.getElementById("trackArtist");
    const shuffleBadge = document.getElementById("shuffleBadge");
    const repeatBadge = document.getElementById("repeatBadge");
    const albumArtEl = document.getElementById("albumArt");
    const progressBar = document.getElementById("progressBar");
    const progressFill = document.getElementById("progressFill");
    const currentTimeEl = document.getElementById("currentTime");
    const totalTimeEl = document.getElementById("totalTime");
    const volumeSlider = document.getElementById("volumeSlider");
    const muteBtn = document.getElementById("muteBtn");
    const shuffleBtn = document.getElementById("shuffleBtn");
    const repeatBtn = document.getElementById("repeatBtn");
    const playlistSearch = document.getElementById("playlistSearch");
    const clearSearch = document.getElementById("clearSearch");
    const barsEl = document.getElementById("bars");

    if (!audio) {
        console.error("Audio element with id='audio' not found.");
        return;
    }

    let currentIndex = 0;
    let isSeeking = false;
    let shuffleEnabled = false;
    let repeatMode = "none";
    let audioCtx = null;
    let analyser = null;
    let freqData = null;
    let rafId = null;

    const BAR_COUNT = 18;
    const barEls = [];

    const clamp = (num, min, max) => Math.min(max, Math.max(min, num));

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
        const total = Math.floor(seconds);
        const min = Math.floor(total / 60);
        const sec = total % 60;
        return min + ":" + String(sec).padStart(2, "0");
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function getTrack() {
        return PLAYLIST[currentIndex];
    }

    function setButtonsPlaying(isPlaying) {
        if (playBtn) playBtn.disabled = isPlaying;
        if (pauseBtn) pauseBtn.disabled = !isPlaying;

        const player = document.querySelector(".player");
        if (player) {
            player.classList.toggle("playing", isPlaying);
        }
    }

    function updateMuteUI() {
        if (muteBtn) {
            muteBtn.textContent = audio.muted || audio.volume === 0 ? "🔇" : "🔊";
        }
    }

    function updateShuffleRepeatUI() {
        if (shuffleBtn) {
            shuffleBtn.setAttribute("aria-pressed", String(shuffleEnabled));
            shuffleBtn.classList.toggle("active", shuffleEnabled);
        }

        if (shuffleBadge) {
            shuffleBadge.textContent = "Shuffle: " + (shuffleEnabled ? "On" : "Off");
        }

        if (repeatBtn) {
            repeatBtn.setAttribute("aria-pressed", repeatMode !== "none" ? "true" : "false");
        }

        if (repeatBadge) {
            if (repeatMode === "one") repeatBadge.textContent = "Repeat: One";
            else if (repeatMode === "all") repeatBadge.textContent = "Repeat: Playlist";
            else repeatBadge.textContent = "Repeat: None";
        }
    }

    function persistState() {
        try {
            const track = getTrack();
            localStorage.setItem("music-player:lastTrackId", track ? track.id : "");
            localStorage.setItem("music-player:shuffle", shuffleEnabled ? "1" : "0");
            localStorage.setItem("music-player:repeat", repeatMode);
            localStorage.setItem("music-player:volume", String(audio.volume));
            localStorage.setItem("music-player:muted", audio.muted ? "1" : "0");
        } catch (err) {}
    }

    function loadPersistedState() {
        try {
            const lastId = localStorage.getItem("music-player:lastTrackId");
            if (lastId) {
                const foundIndex = PLAYLIST.findIndex((track) => track.id === lastId);
                if (foundIndex >= 0) currentIndex = foundIndex;
            }

            shuffleEnabled = localStorage.getItem("music-player:shuffle") === "1";

            const savedRepeat = localStorage.getItem("music-player:repeat");
            repeatMode = ["none", "one", "all"].includes(savedRepeat) ? savedRepeat : "none";

            const savedVolume = parseFloat(localStorage.getItem("music-player:volume") || "0.8");
            audio.volume = Number.isFinite(savedVolume) ? clamp(savedVolume, 0, 1) : 0.8;

            audio.muted = localStorage.getItem("music-player:muted") === "1";
            if (volumeSlider) volumeSlider.value = String(audio.volume);
        } catch (err) {}
    }

    function nextIndex() {
        if (PLAYLIST.length <= 1) return currentIndex;

        if (shuffleEnabled) {
            let randomIndex = currentIndex;
            while (randomIndex === currentIndex) {
                randomIndex = Math.floor(Math.random() * PLAYLIST.length);
            }
            return randomIndex;
        }

        return (currentIndex + 1) % PLAYLIST.length;
    }

    function prevIndex() {
        if (PLAYLIST.length <= 1) return currentIndex;
        if (audio.currentTime > 3) return currentIndex;
        return (currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    }

    function setActivePlaylistItem() {
        if (!playlistEl) return;
        const items = playlistEl.querySelectorAll(".song");
        items.forEach((item) => {
            item.classList.toggle("active", Number(item.dataset.index) === currentIndex);
        });
    }

    function renderPlaylist(filterText = "") {
        if (!playlistEl) return;

        const query = filterText.trim().toLowerCase();
        playlistEl.innerHTML = "";

        const filteredTracks = PLAYLIST.filter((track) => {
            const text = (track.title + " " + track.artist).toLowerCase();
            return !query || text.includes(query);
        });

        filteredTracks.forEach((track) => {
            const actualIndex = PLAYLIST.findIndex((item) => item.id === track.id);

            const item = document.createElement("div");
            item.className = "song" + (actualIndex === currentIndex ? " active" : "");
            item.dataset.index = String(actualIndex);
            item.tabIndex = 0;
            item.setAttribute("role", "button");
            item.setAttribute("aria-label", "Play " + track.title + " by " + track.artist);

            item.innerHTML = `
        <div class="song__index">${String(actualIndex + 1).padStart(2, "0")}</div>
        <div>
          <div class="song__title">${escapeHtml(track.title)}</div>
          <div class="song__artist">${escapeHtml(track.artist)}</div>
        </div>
        <div class="song__dur">—</div>
      `;

            item.addEventListener("click", () => {
                playTrackByIndex(actualIndex, true);
            });

            item.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    playTrackByIndex(actualIndex, true);
                }
            });

            playlistEl.appendChild(item);
        });
    }

    async function playTrackByIndex(index, autoplay = false) {
        const safeIndex = clamp(index, 0, PLAYLIST.length - 1);
        const track = PLAYLIST[safeIndex];

        if (!track) return;

        currentIndex = safeIndex;

        if (trackTitleEl) trackTitleEl.textContent = track.title;
        if (trackArtistEl) trackArtistEl.textContent = track.artist;
        if (albumArtEl) albumArtEl.src = track.image || "assets/images/album1.jpg";

        audio.src = track.src;
        audio.load();

        if (progressBar) progressBar.value = "0";
        if (progressFill) progressFill.style.width = "0%";
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
        if (totalTimeEl) totalTimeEl.textContent = "0:00";

        setActivePlaylistItem();

        if (albumArtEl) applyBackgroundFromAlbumArt(albumArtEl.src);

        persistState();

        if (autoplay) {
            try {
                await audio.play();
                setButtonsPlaying(true);
                startVisualizer();
            } catch (error) {
                console.log("Playback failed:", error);
                setButtonsPlaying(false);
                stopVisualizer();
            }
        }
    }

    function togglePlayPause() {
        if (audio.paused) {
            audio.play()
                .then(() => {
                    setButtonsPlaying(true);
                    startVisualizer();
                })
                .catch((error) => {
                    console.log("Play failed:", error);
                });
        } else {
            audio.pause();
            setButtonsPlaying(false);
            stopVisualizer();
        }
    }

    async function playNext() {
        await playTrackByIndex(nextIndex(), true);
    }

    async function playPrev() {
        const index = prevIndex();

        if (index === currentIndex && audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }

        await playTrackByIndex(index, true);
    }

    function updateProgressUI() {
        const duration = audio.duration;

        if (!Number.isFinite(duration) || duration <= 0) {
            if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
            if (totalTimeEl) totalTimeEl.textContent = "0:00";
            if (progressBar) progressBar.value = "0";
            if (progressFill) progressFill.style.width = "0%";
            return;
        }

        const ratio = clamp(audio.currentTime / duration, 0, 1);
        const value = Math.round(ratio * 1000);

        if (progressBar) progressBar.value = String(value);
        if (progressFill) progressFill.style.width = ratio * 100 + "%";
        if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
        if (totalTimeEl) totalTimeEl.textContent = formatTime(duration);
    }

    function seekFromProgress() {
        if (!progressBar) return;

        const duration = audio.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;

        const value = parseInt(progressBar.value, 10);
        const ratio = clamp(value / 1000, 0, 1);

        audio.currentTime = duration * ratio;
    }

    function applyVolumeFromSlider() {
        if (!volumeSlider) return;

        audio.volume = clamp(parseFloat(volumeSlider.value), 0, 1);
        audio.muted = audio.volume === 0;
        updateMuteUI();
        persistState();
    }

    function toggleMute() {
        audio.muted = !audio.muted;
        updateMuteUI();
        persistState();
    }

    function cycleRepeat() {
        if (repeatMode === "none") repeatMode = "one";
        else if (repeatMode === "one") repeatMode = "all";
        else repeatMode = "none";

        updateShuffleRepeatUI();
        persistState();
    }

    async function applyBackgroundFromAlbumArt(imageUrl) {
        try {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.src = imageUrl;

            await new Promise((resolve) => {
                image.onload = resolve;
                image.onerror = resolve;
            });

            const canvas = document.createElement("canvas");
            canvas.width = 48;
            canvas.height = 48;

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) return;

            ctx.drawImage(image, 0, 0, 48, 48);
            const imageData = ctx.getImageData(0, 0, 48, 48).data;

            let r = 0;
            let g = 0;
            let b = 0;
            let count = 0;

            for (let i = 0; i < imageData.length; i += 4) {
                r += imageData[i];
                g += imageData[i + 1];
                b += imageData[i + 2];
                count++;
            }

            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);

            const bg = document.querySelector(".bg");
            if (!bg) return;

            const r2 = Math.round(r * 0.6);
            const g2 = Math.round(g * 0.6);
            const b2 = Math.round(b * 0.6);

            bg.style.background =
                "radial-gradient(circle at 30% 20%, rgba(" + r + "," + g + "," + b + ",.28), transparent 45%), " +
                "radial-gradient(circle at 80% 60%, rgba(" + r2 + "," + g2 + "," + b2 + ",.30), transparent 50%)";
        } catch (err) {}
    }

    function buildBars() {
        if (!barsEl) return;

        barsEl.innerHTML = "";
        barEls.length = 0;

        for (let i = 0; i < BAR_COUNT; i++) {
            const bar = document.createElement("div");
            bar.className = "bar";
            barsEl.appendChild(bar);
            barEls.push(bar);
        }
    }

    function ensureAudioGraph() {
        if (audioCtx) return;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        audioCtx = new AudioContextClass();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        freqData = new Uint8Array(analyser.frequencyBinCount);

        const source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    function startVisualizer() {
        try {
            ensureAudioGraph();
            if (audioCtx && audioCtx.state === "suspended") {
                audioCtx.resume();
            }
        } catch (err) {
            return;
        }

        if (!analyser || !freqData || barEls.length === 0) return;

        if (rafId) cancelAnimationFrame(rafId);

        const tick = () => {
            analyser.getByteFrequencyData(freqData);

            const step = Math.floor(freqData.length / BAR_COUNT);

            for (let i = 0; i < BAR_COUNT; i++) {
                const start = i * step;
                const end = start + step;
                let sum = 0;
                let samples = 0;

                for (let j = start; j < end; j++) {
                    sum += freqData[j] || 0;
                    samples++;
                }

                const average = samples ? sum / samples : 0;
                const height = 10 + clamp(average / 255, 0, 1) * 80;

                barEls[i].style.height = height + "px";
                barEls[i].classList.toggle("active", height > 15);
            }

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
    }

    function stopVisualizer() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;

        barEls.forEach((bar) => {
            bar.style.height = "10px";
            bar.classList.remove("active");
        });
    }

    function wireControls() {
        if (playBtn) playBtn.addEventListener("click", togglePlayPause);
        if (pauseBtn) pauseBtn.addEventListener("click", togglePlayPause);
        if (nextBtn) nextBtn.addEventListener("click", playNext);
        if (prevBtn) prevBtn.addEventListener("click", playPrev);

        if (shuffleBtn) {
            shuffleBtn.addEventListener("click", () => {
                shuffleEnabled = !shuffleEnabled;
                updateShuffleRepeatUI();
                persistState();
            });
        }

        if (repeatBtn) repeatBtn.addEventListener("click", cycleRepeat);
        if (volumeSlider) volumeSlider.addEventListener("input", applyVolumeFromSlider);
        if (muteBtn) muteBtn.addEventListener("click", toggleMute);

        if (progressBar) {
            progressBar.addEventListener("pointerdown", () => {
                isSeeking = true;
            });

            progressBar.addEventListener("pointerup", () => {
                isSeeking = false;
                seekFromProgress();
            });

            progressBar.addEventListener("input", () => {
                if (isSeeking) seekFromProgress();
            });
        }

        if (playlistSearch) {
            playlistSearch.addEventListener("input", () => {
                renderPlaylist(playlistSearch.value);
            });
        }

        if (clearSearch) {
            clearSearch.addEventListener("click", () => {
                playlistSearch.value = "";
                renderPlaylist("");
                playlistSearch.focus();
            });
        }
    }

    function wireAudioEvents() {
        audio.addEventListener("loadedmetadata", updateProgressUI);

        audio.addEventListener("timeupdate", () => {
            if (!isSeeking) updateProgressUI();
        });

        audio.addEventListener("play", () => {
            setButtonsPlaying(true);
            startVisualizer();
        });

        audio.addEventListener("pause", () => {
            setButtonsPlaying(false);
            stopVisualizer();
        });

        audio.addEventListener("ended", async() => {
            if (repeatMode === "one") {
                audio.currentTime = 0;
                await audio.play();
                return;
            }

            if (repeatMode === "none" && currentIndex === PLAYLIST.length - 1 && !shuffleEnabled) {
                setButtonsPlaying(false);
                stopVisualizer();
                return;
            }

            await playNext();
        });
    }

    function wireKeyboardShortcuts() {
        document.addEventListener("keydown", (event) => {
            const activeElement = document.activeElement;
            const tag = activeElement ? activeElement.tagName.toLowerCase() : "";

            if (tag === "input" || tag === "textarea") return;

            if (event.key === " " || event.code === "Space") {
                event.preventDefault();
                togglePlayPause();
            }

            if (event.key === "ArrowRight") {
                event.preventDefault();
                playNext();
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                playPrev();
            }
        });
    }

    function init() {
        buildBars();
        loadPersistedState();
        updateShuffleRepeatUI();
        renderPlaylist("");

        const track = getTrack();

        if (track) {
            if (trackTitleEl) trackTitleEl.textContent = track.title;
            if (trackArtistEl) trackArtistEl.textContent = track.artist;
            if (albumArtEl) albumArtEl.src = track.image || "assets/images/album1.jpg";
            audio.src = track.src;
            audio.load();
        }

        updateProgressUI();
        updateMuteUI();
        setButtonsPlaying(false);

        if (albumArtEl) applyBackgroundFromAlbumArt(albumArtEl.src);

        wireControls();
        wireAudioEvents();
        wireKeyboardShortcuts();
    }

    init();
})();