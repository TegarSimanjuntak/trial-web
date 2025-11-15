// --- Ganti seluruh file SpeechPage.jsx dengan kode berikut ---
import React, { useEffect, useRef, useState } from "react";

/**
 * SpeechPage.jsx (Fixed: scale + no-page-scroll + fixes)
 * - Perbaikan STT race condition (lastTranscript)
 * - Tombol close kembali ke halaman sebelumnya
 * - Handler WebGL context lost + safer pixel ratio
 * - Debug console.log untuk send/play/context-lost
 */

export default function SpeechPage({ session }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [topChunks, setTopChunks] = useState([]);
  const [sending, setSending] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [threeLoaded, setThreeLoaded] = useState(false);

  const canvasContainerRef = useRef(null);
  const threeRef = useRef(null);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const topK = 3;

  // Load Three.js from CDN if missing
  useEffect(() => {
    let cancelled = false;
    async function ensureThree() {
      if (window.THREE) {
        setThreeLoaded(true);
        return;
      }
      const url = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      try {
        await loadScript(url);
        if (!cancelled) setThreeLoaded(Boolean(window.THREE));
      } catch (e) {
        console.error("Gagal memuat three.js:", e);
        if (!cancelled) setError("Gagal memuat Three.js (CDN). Periksa koneksi.");
      }
    }
    ensureThree();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!threeLoaded) return;
    initThree();
    return () => {
      cleanupThree();
      stopSpeech();
      stopRecognition();
    };
    // eslint-disable-next-line
  }, [threeLoaded]);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.getElementsByTagName("script")).find(s => s.src === src);
      if (existing) {
        if (existing.getAttribute("data-loaded") === "true") return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", (e) => reject(e));
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = () => { s.setAttribute("data-loaded", "true"); resolve(); };
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  // ---------- SpeechRecognition & TTS ----------
  function supportsRecognition() { return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function supportsTTS() { return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance); }

  function startRecognition() {
    setError(null);
    if (!supportsRecognition()) { setError("SpeechRecognition tidak didukung di browser ini."); return; }
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.lang = "id-ID";
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      // use closure var to avoid React state race
      let lastTranscript = "";

      rec.onresult = (e) => {
        const t = (e.results && e.results[0] && e.results[0][0] && e.results[0][0].transcript) ? e.results[0][0].transcript : "";
        lastTranscript = t;
        console.log("[STT] onresult transcript:", t);
        setTranscript(t);
      };

      rec.onerror = (e) => {
        console.warn("recognition error", e);
        setError("Kesalahan saat merekam: " + (e.error || e.message || ""));
        setListening(false);
        updateRobotListening(false);
      };

      // onend gunakan lastTranscript snapshot agar tidak kosong karena race setState
      rec.onend = () => {
        setListening(false);
        updateRobotListening(false);
        console.log("[STT] onend, lastTranscript:", lastTranscript);
        if (lastTranscript && lastTranscript.trim()) {
          sendQuestion(lastTranscript);
        } else {
          console.log("[STT] tidak ada transcript untuk dikirim.");
        }
      };

      recognitionRef.current = rec;
      setTranscript("");
      rec.start();
      setListening(true);
      updateRobotListening(true);
    } catch (e) {
      console.error("startRecognition failed", e);
      setError("Gagal memulai perekaman: " + (e.message || e));
    }
  }

  function stopRecognition() {
    try {
      const r = recognitionRef.current;
      if (r && typeof r.stop === "function") r.stop();
    } catch (e) {
      console.warn("stopRecognition err", e);
    } finally {
      recognitionRef.current = null;
      setListening(false);
      updateRobotListening(false);
    }
  }

  function playSpeech(text) {
    if (!supportsTTS()) { setError("TTS tidak didukung di browser ini."); return; }
    stopSpeech();
    console.log("[TTS] playSpeech called with:", text);
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = "id-ID";
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find(v => (v.lang || "").toLowerCase().includes("id")) || voices[0];
    if (pref) ut.voice = pref;
    ut.rate = 0.95;
    ut.pitch = 1.05;
    ut.onstart = () => { utteranceRef.current = ut; setPlaying(true); updateRobotSpeaking(true); updateCharacterStatus("Berbicara"); console.log("[TTS] onstart"); };
    ut.onend = () => { setPlaying(false); updateRobotSpeaking(false); updateCharacterStatus("Siap membantu"); utteranceRef.current = null; console.log("[TTS] onend"); };
    ut.onerror = (e) => { console.warn("TTS error", e); setPlaying(false); updateRobotSpeaking(false); setError("Kesalahan saat memutar suara."); };
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(ut);
    } catch (e) {
      console.warn("speak failed", e);
      setError("Gagal menjalankan TTS: " + (e.message || e));
    }
  }

  function stopSpeech() {
    try { if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.cancel(); } catch (e) { console.warn("stopSpeech err", e); }
    finally { utteranceRef.current = null; setPlaying(false); updateRobotSpeaking(false); updateCharacterStatus("Siap membantu"); }
  }

  async function sendQuestion(q) {
    if (!q || !q.trim()) return;
    setSending(true); setError(null); setReply(""); setTopChunks([]);
    try {
      console.log("[NET] sending question:", q);
      const resp = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, k: topK }) });
      if (!resp.ok) {
        const txt = await resp.text().catch(()=>"");
        throw new Error(`Server ${resp.status}: ${txt || resp.statusText}`);
      }
      const data = await resp.json();
      console.log("[NET] response:", data);
      const modelReply = data.reply || "";
      const top_chunks = data.top_chunks || data.topChunks || [];
      setReply(modelReply);
      setTopChunks(top_chunks);
      analyzeTextAndSetExpression(modelReply || q);
      if (modelReply && modelReply.trim()) playSpeech(modelReply);
    } catch (e) {
      console.error(e);
      setError("Gagal mengirim pertanyaan: " + (e.message || e));
    } finally {
      setSending(false);
    }
  }

  function handleMicClick() {
    setError(null);
    if (listening) { stopRecognition(); return; }
    setTranscript("");
    startRecognition();
  }

  // Stop + kembali ke halaman sebelumnya
  // 1) handler: Stop hanya hentikan TTS/STT
  function handleStopOnly() {
    stopSpeech();
    stopRecognition();
  }

  // 2) handler: Close = stop + back
  function handleClose() {
    stopSpeech();
    stopRecognition();
    try {
      if (window.history && window.history.length > 1) window.history.back();
      else window.location.href = "/";
    } catch (e) {
      window.location.href = "/";
    }
  }


  // ---------- THREE.JS scene (scale + fit) ----------
  function initThree() {
    const THREE = window.THREE;
    if (!THREE) { console.warn("Three.js tidak tersedia"); setError("Three.js belum tersedia."); return; }
    const container = canvasContainerRef.current;
    if (!container) return;

    // ukuran mengikuti container
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    // scene / camera / renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1724);

    // camera lebih mundur (zoom out) supaya robot tidak terlalu besar
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 1.35, 5.6);
    camera.lookAt(0, 1.0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    // safer pixel ratio to reduce chance of context lost on mobile/low-GPU
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    // hapus child lama & append
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    // add context-lost handler to try re-init gracefully
    const onContextLost = (ev) => {
      ev.preventDefault();
      console.warn("WebGL context lost — akan mencoba re-init scene.");
      setError("Rendering terhenti (WebGL context lost). Mencoba memuat ulang scene...");
      // cleanup and attempt reinit
      try { cleanupThree(); } catch (e) { console.warn("cleanup error after context lost", e); }
      setTimeout(() => {
        try { initThree(); } catch (e) { console.error("Re-init three gagal", e); setError("Gagal memuat ulang scene 3D."); }
      }, 600);
    };
    renderer.domElement.addEventListener && renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    // lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 5);
    dir.castShadow = true;
    scene.add(dir);
    const neon1 = new THREE.PointLight(0x8be9ff, 0.9, 50);
    neon1.position.set(-3, 3, 3);
    scene.add(neon1);
    const neon2 = new THREE.PointLight(0xff8bd1, 0.6, 50);
    neon2.position.set(3, 2.8, 3);
    scene.add(neon2);

    const clock = new THREE.Clock();

    // build robot and scale it down
    const robot = buildFancyRobotWithGlass(THREE);
    const desiredScale = 1.2;
    robot.group.scale.set(desiredScale, desiredScale, desiredScale);

    scene.add(robot.group);

    threeRef.current = { THREE, scene, camera, renderer, robot, clock, mounted: true, isSpeaking: false, isListening: false, currentExpression: "normal", _onContextLost: onContextLost };

    // resize handler (use container size)
    function onResize() {
      if (!threeRef.current) return;
      const c = canvasContainerRef.current;
      const W = Math.max(1, c.clientWidth);
      const H = Math.max(1, c.clientHeight);
      threeRef.current.camera.aspect = W / H;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(W, H);
      threeRef.current.renderer.domElement.style.height = "100%";

      if (W < 800) {
        threeRef.current.camera.position.set(0, 1.35, 6.4);
      } else {
        threeRef.current.camera.position.set(0, 1.35, 5.6);
      }
    }
    window.addEventListener("resize", onResize);
    threeRef.current._onResize = onResize;

    // animate
    function loop() {
      if (!threeRef.current || !threeRef.current.mounted) return;
      const s = threeRef.current;
      const t = s.clock.getElapsedTime();

      if (s.robot && !s.isSpeaking) {
        s.robot.group.position.y = s.robot.baseY + Math.sin(t * 1.2) * 0.1;
        s.robot.group.rotation.y = Math.sin(t * 0.12) * 0.04;
        s.robot.leftAntenna.rotation.z = Math.sin(t * 2) * 0.08;
        s.robot.rightAntenna.rotation.z = Math.sin(t * 2 + Math.PI) * 0.08;
        const pulse = 0.35 + Math.sin(t * 2.4) * 0.18;
        if (s.robot.leftEye && s.robot.rightEye) {
          s.robot.leftEye.material.emissiveIntensity = pulse;
          s.robot.rightEye.material.emissiveIntensity = pulse;
        }
      }

      if (s.isSpeaking) {
        s.robot.group.position.y = s.robot.baseY + Math.sin(t * 3.2) * 0.12;
        s.robot.group.rotation.y = Math.sin(t * 1.6) * 0.12;
        if (s.robot.body) s.robot.body.rotation.x = Math.sin(t * 2.8) * 0.05;
        const mouthScale = 1 + Math.abs(Math.sin(t * 9)) * 0.5;
        if (s.robot.mouth) s.robot.mouth.scale.set(mouthScale, mouthScale, 1);
        if (s.robot.leftArm) s.robot.leftArm.rotation.z = Math.sin(t * 4) * 0.18;
        if (s.robot.rightArm) s.robot.rightArm.rotation.z = Math.sin(t * 4 + Math.PI) * 0.18;
        const baseI = s.currentExpression === "angry" ? 0.95 : 0.6;
        const spI = baseI + Math.sin(t * 6) * 0.35;
        if (s.robot.leftEye && s.robot.rightEye) {
          s.robot.leftEye.material.emissiveIntensity = spI;
          s.robot.rightEye.material.emissiveIntensity = spI;
        }
        if (s.robot.screenGlass && s.robot.screenGlass.material) {
          s.robot.screenGlass.material.clearcoat = 0.3 + Math.abs(Math.sin(t * 2)) * 0.3;
        }
      }

      if (s.isListening) {
        s.robot.group.rotation.z = Math.sin(t * 1.6) * 0.04;
        if (s.robot.leftTip && s.robot.rightTip) {
          s.robot.leftTip.material.emissiveIntensity = Math.abs(Math.sin(t * 8)) * 0.9 + 0.1;
          s.robot.rightTip.material.emissiveIntensity = Math.abs(Math.cos(t * 8)) * 0.9 + 0.1;
        }
      }

      s.renderer.render(s.scene, s.camera);
      s._animId = requestAnimationFrame(loop);
    }
    loop();
  }

  function cleanupThree() {
    const s = threeRef.current;
    if (!s) return;
    s.mounted = false;
    if (s._animId) cancelAnimationFrame(s._animId);
    try {
      window.removeEventListener("resize", s._onResize);
    } catch (e) {}
    try {
      if (s.renderer && s.renderer.domElement && s._onContextLost) {
        s.renderer.domElement.removeEventListener && s.renderer.domElement.removeEventListener('webglcontextlost', s._onContextLost);
      }
    } catch (e) {}
    try {
      if (s.renderer && typeof s.renderer.forceContextLoss === "function") s.renderer.forceContextLoss();
    } catch (e) {}
    try {
      if (s.renderer && s.renderer.domElement && s.renderer.domElement.parentNode) s.renderer.domElement.parentNode.removeChild(s.renderer.domElement);
    } catch (e) {}
    threeRef.current = null;
  }

  // Build fancy robot with glass; same as before but returns parts references
  function buildFancyRobotWithGlass(THREE) {
    const group = new THREE.Group();

    // body
    const bodyGeom = new THREE.BoxGeometry(1, 1.2, 0.8);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x6c5ce7, shininess: 150 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    // screen (inner)
    const screenGeom = new THREE.BoxGeometry(0.78, 0.52, 0.02);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: 0x062bff,
      emissiveIntensity: 0.04,
      metalness: 0.1,
      roughness: 0.6,
    });
    const screen = new THREE.Mesh(screenGeom, screenMat);
    screen.position.set(0, 0.92, 0.43);
    screen.renderOrder = 1;
    group.add(screen);

    // frame
    const frameGeom = new THREE.BoxGeometry(0.84, 0.58, 0.06);
    const frameMat = new THREE.MeshPhongMaterial({ color: 0x5b4ef6, shininess: 110 });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.set(0, 0.92, 0.35);
    group.add(frame);

    // glass overlay
    let screenGlass = null;
    try {
      const glassGeom = new THREE.PlaneGeometry(0.78, 0.52);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x111111,
        metalness: 0.0,
        roughness: 0.15,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        transmission: 0.12,
        opacity: 0.6,
        transparent: true,
        reflectivity: 0.6
      });
      screenGlass = new THREE.Mesh(glassGeom, glassMat);
      screenGlass.position.set(0, 0.92, 0.455);
      screenGlass.renderOrder = 2;
      group.add(screenGlass);
    } catch (e) {
      const fallback = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.52), new THREE.MeshPhongMaterial({ color: 0x000011, shininess: 80, opacity: 0.45, transparent: true }));
      fallback.position.set(0, 0.92, 0.455);
      fallback.renderOrder = 2;
      group.add(fallback);
      screenGlass = fallback;
    }

    // eyes (spheres in front)
    const pupilGeom = new THREE.SphereGeometry(0.06, 16, 12);
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x48ffda, emissive: 0x00f3d9, emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.2 });
    const leftEye = new THREE.Mesh(pupilGeom, pupilMat.clone());
    leftEye.position.set(-0.17, 0.92, 0.52);
    leftEye.renderOrder = 3;
    group.add(leftEye);
    const rightEye = new THREE.Mesh(pupilGeom, pupilMat.clone());
    rightEye.position.set(0.17, 0.92, 0.52);
    rightEye.renderOrder = 3;
    group.add(rightEye);

    // eye highlights
    const highlightGeom = new THREE.SphereGeometry(0.015, 8, 8);
    const hMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hl1 = new THREE.Mesh(highlightGeom, hMat);
    hl1.position.set(-0.14, 0.95, 0.56);
    hl1.renderOrder = 4;
    group.add(hl1);
    const hl2 = new THREE.Mesh(highlightGeom, hMat);
    hl2.position.set(0.2, 0.95, 0.56);
    hl2.renderOrder = 4;
    group.add(hl2);

    // mouth
    const mouthGeom = new THREE.RingGeometry(0.035, 0.09, 32, 1, Math.PI, Math.PI);
    const mouthMat = new THREE.MeshPhongMaterial({ color: 0xff9aa2, emissive: 0xff6f82, emissiveIntensity: 0.5 });
    const mouth = new THREE.Mesh(mouthGeom, mouthMat);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, 0.78, 0.52);
    mouth.renderOrder = 3;
    group.add(mouth);

    // heart chest
    const heartGeom = new THREE.CircleGeometry(0.09, 32);
    const heartMat = new THREE.MeshPhongMaterial({ color: 0xff4757, emissive: 0xff4757, emissiveIntensity: 0.6 });
    const heart = new THREE.Mesh(heartGeom, heartMat);
    heart.position.set(0, 0.32, 0.41);
    group.add(heart);

    // antenna, tips
    const antGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8);
    const antMat = new THREE.MeshPhongMaterial({ color: 0x7f8c8d });
    const leftAntenna = new THREE.Mesh(antGeom, antMat);
    leftAntenna.position.set(-0.2, 1.38, 0);
    group.add(leftAntenna);
    const rightAntenna = new THREE.Mesh(antGeom, antMat);
    rightAntenna.position.set(0.2, 1.38, 0);
    group.add(rightAntenna);

    const tipGeom = new THREE.SphereGeometry(0.05, 8, 8);
    const tipMat = new THREE.MeshPhongMaterial({ color: 0xff4d4d, emissive: 0xff4d4d, emissiveIntensity: 0.9 });
    const leftTip = new THREE.Mesh(tipGeom, tipMat.clone());
    leftTip.position.set(-0.2, 1.52, 0);
    group.add(leftTip);
    const rightTip = new THREE.Mesh(tipGeom, tipMat.clone());
    rightTip.position.set(0.2, 1.52, 0);
    group.add(rightTip);

    // arms & hands
    const armGeom = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armMat = new THREE.MeshPhongMaterial({ color: 0xa29bfe });
    const leftArm = new THREE.Mesh(armGeom, armMat);
    leftArm.position.set(-0.65, 0.25, 0);
    group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeom, armMat.clone());
    rightArm.position.set(0.65, 0.25, 0);
    group.add(rightArm);

    const handGeom = new THREE.SphereGeometry(0.12, 12, 12);
    const handMat = new THREE.MeshPhongMaterial({ color: 0xfd79a8, shininess: 120 });
    const leftHand = new THREE.Mesh(handGeom, handMat);
    leftHand.position.set(-0.65, -0.15, 0);
    group.add(leftHand);
    const rightHand = new THREE.Mesh(handGeom, handMat.clone());
    rightHand.position.set(0.65, -0.15, 0);
    group.add(rightHand);

    // legs & feet
    const legGeom = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    const legMat = new THREE.MeshPhongMaterial({ color: 0xa29bfe });
    const leftLeg = new THREE.Mesh(legGeom, legMat);
    leftLeg.position.set(-0.25, -0.55, 0);
    group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeom, legMat.clone());
    rightLeg.position.set(0.25, -0.55, 0);
    group.add(rightLeg);

    const footGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16);
    footGeom.rotateX(Math.PI / 2);
    const footMat = new THREE.MeshPhongMaterial({ color: 0x6c5ce7 });
    const leftFoot = new THREE.Mesh(footGeom, footMat);
    leftFoot.position.set(-0.25, -1.0, 0.1);
    group.add(leftFoot);
    const rightFoot = new THREE.Mesh(footGeom, footMat.clone());
    rightFoot.position.set(0.25, -1.0, 0.1);
    group.add(rightFoot);

    group.position.y = 0.85;

    return {
      group,
      body,
      screen,
      screenGlass,
      leftEye,
      rightEye,
      mouth,
      heart,
      leftAntenna,
      rightAntenna,
      leftTip,
      rightTip,
      leftArm,
      rightArm,
      leftHand,
      rightHand,
      leftLeg,
      rightLeg,
      leftFoot,
      rightFoot,
      baseY: group.position.y
    };
  }

  // visual helpers
  function updateRobotSpeaking(val) {
    const s = threeRef.current;
    if (!s) return;
    s.isSpeaking = val;
  }
  function updateRobotListening(val) {
    const s = threeRef.current;
    if (!s) return;
    s.isListening = val;
  }
  function updateRobotExpression(expr) {
    const s = threeRef.current;
    if (!s || !s.robot) return;
    s.currentExpression = expr;
    const r = s.robot;
    switch (expr) {
      case "happy":
        if (r.leftEye) r.leftEye.material.color.setHex(0x00ff66);
        if (r.rightEye) r.rightEye.material.color.setHex(0x00ff66);
        if (r.mouth) r.mouth.material.color.setHex(0x00ff66);
        break;
      case "sad":
        if (r.leftEye) r.leftEye.material.color.setHex(0x0066ff);
        if (r.rightEye) r.rightEye.material.color.setHex(0x0066ff);
        if (r.mouth) r.mouth.material.color.setHex(0x0066ff);
        break;
      case "angry":
        if (r.leftEye) r.leftEye.material.color.setHex(0xff0000);
        if (r.rightEye) r.rightEye.material.color.setHex(0xff0000);
        if (r.mouth) r.mouth.material.color.setHex(0xff0000);
        break;
      default:
        if (r.leftEye) r.leftEye.material.color.setHex(0x48ffda);
        if (r.rightEye) r.rightEye.material.color.setHex(0x48ffda);
        if (r.mouth) r.mouth.material.color.setHex(0xff9aa2);
        break;
    }
  }

  function analyzeTextAndSetExpression(text) {
    const lower = (text || "").toLowerCase();
    if (lower.includes("senang") || lower.includes("bahagia") || lower.includes("gembira")) updateRobotExpression("happy");
    else if (lower.includes("sedih") || lower.includes("kecewa")) updateRobotExpression("sad");
    else if (lower.includes("marah") || lower.includes("kesal")) updateRobotExpression("angry");
    else updateRobotExpression("normal");
  }

  function updateCharacterStatus(status) {
    // placeholder - bisa sambungkan ke state
  }

  // ---------- UI ----------
  return (
    // fixed to viewport to avoid page scroll caused by this component
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Speech → Speech (Voice + 3D)</div>
        <div style={styles.headerRight}>
          <div style={{ color: "#666", fontSize: 13, marginRight: 12 }}>{session?.user?.email || "guest"}</div>
          <div style={styles.stopX} title="Hentikan output & rekaman" onClick={handleClose}>✕</div>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.left}>
          <div ref={canvasContainerRef} style={styles.canvasArea}>
            {!threeLoaded && <div style={{ color: "#cfe8ff", textAlign: "center" }}>Memuat Three.js...</div>}
            {error && <div style={{ position: "absolute", top: 12, right: 12, background: "#ffdede", padding: 8, borderRadius: 8, color: "#700" }}>{error}</div>}
          </div>

          <div style={styles.controlsRow}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={handleMicClick} style={{ ...styles.bigBtn, background: listening ? "#ff6b6b" : "#2d9cdb" }} disabled={sending}>
                {listening ? "🎙️ Merekam..." : "🎤 Tekan untuk Bicara"}
              </button>
              <button onClick={handleStopOnly} style={styles.stopBtn}>🛑 Stop</button>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "stretch", width: "60%" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Transkripsi</div>
                <div style={styles.smallBox}>{transcript || <span style={{ color: "#999" }}>Belum ada</span>}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Balasan</div>
                <div style={styles.smallBox}>{reply || <span style={{ color: "#999" }}>Belum ada balasan</span>}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            {sending && <div style={styles.pill}>Mengirim…</div>}
            {playing && <div style={styles.pill}>Memutar suara…</div>}
          </div>
        </div>

        <aside style={styles.right}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Top {topK}</div>
          <div style={{ color: "#666", marginBottom: 8 }}>Potongan konteks (top_chunks)</div>
          <div style={{ overflowY: "auto", maxHeight: "100%", paddingRight: 6 }}>
            {topChunks && topChunks.length ? topChunks.map((c, i) => (
              <div key={i} style={styles.chunkCard}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {c.document_title || c.document_id || `doc ${i+1}`}
                  <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 12, color: "#666" }}>idx:{c.chunk_index ?? "-"} sim:{(Number(c.similarity || 0)).toFixed(3)}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {String(c.text || "").slice(0, 450)}{String(c.text || "").length > 450 ? "…" : ""}
                </div>
              </div>
            )) : <div style={{ color: "#999" }}>Top chunks akan muncul setelah kamu bertanya.</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- styles ----------
const styles = {
  page: {
    position: "fixed",
    inset: 0,
    boxSizing: "border-box",
    padding: 12,
    fontFamily: "Inter, Roboto, system-ui, Arial",
    color: "#0b0b0b",
    overflow: "hidden",
    background: "#f7fafc",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingLeft: 8,
    paddingRight: 8
  },
  headerRight: { display: "flex", alignItems: "center" },
  stopX: {
    cursor: "pointer",
    padding: "6px 10px",
    borderRadius: 8,
    background: "#ffecec",
    color: "#b00000",
    fontWeight: 700
  },
  container: {
    display: "flex",
    gap: 12,
    height: "calc(100% - 56px)"
  },
  left: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 0
  },
  canvasArea: {
    flex: 1,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    background: "linear-gradient(180deg,#091125 0%, #0b1a2b 100%)",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260
  },
  controlsRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    background: "#fff",
    padding: 10,
    borderRadius: 10,
    boxShadow: "0 6px 24px rgba(10,20,30,0.06)"
  },
  bigBtn: {
    border: "none",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 14
  },
  stopBtn: {
    border: "none",
    background: "#ff6b6b",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700
  },
  smallBox: { background: "#f8fafc", padding: 10, borderRadius: 8, minHeight: 48, color: "#111" },
  pill: { padding: "6px 10px", background: "#eef6ff", borderRadius: 999, fontSize: 13, color: "#234" },
  right: {
    width: 360,
    minWidth: 260,
    background: "#fff",
    padding: 12,
    borderRadius: 10,
    boxShadow: "0 6px 24px rgba(10,20,30,0.06)",
    overflowY: "auto",
    height: "100%"
  },
  chunkCard: { padding: 10, borderRadius: 8, border: "1px solid #f2f4f7", marginBottom: 12, background: "#fff" }
};
