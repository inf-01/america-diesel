/* ==================================================================
   AMERICAN DIESEL — main.js
   ------------------------------------------------------------------
   Módulos:
     1. Utilidades y detección de contexto
     2. Lenis (smooth scroll) + enlaces ancla
     3. Cursor personalizado
     4. Three.js (escena 3D reactiva al scroll)
     5. Preloader (timeline GSAP)
     6. Animaciones de entrada (Hero)
     7. ScrollTrigger por secciones + contadores
     8. Arranque
   ================================================================== */
(() => {
  'use strict';

  /* ============ 1. UTILIDADES ============ */
  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOUCH = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const HAS_GSAP = typeof window.gsap !== 'undefined';
  const HAS_ST = typeof window.ScrollTrigger !== 'undefined';
  const HAS_LENIS = typeof window.Lenis !== 'undefined';
  const HAS_THREE = typeof window.THREE !== 'undefined';

  if (HAS_GSAP && HAS_ST) gsap.registerPlugin(ScrollTrigger);

  /* Objeto compartido: progreso global del scroll (0 → 1) para el 3D */
  const webglState = { progress: 0 };

  /* ============ 2. LENIS — SMOOTH SCROLL ============ */
  let lenis = null;

  function initLenis() {
    if (!HAS_LENIS || REDUCED) return;

    lenis = new Lenis({
      duration: 1.2,
      // Easing equivalente a power2.inOut de GSAP
      easing: HAS_GSAP
        ? gsap.parseEase('power2.inOut')
        : (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    if (HAS_GSAP && HAS_ST) {
      // Sincroniza Lenis con ScrollTrigger vía el ticker de GSAP
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }

    // Bloquea el scroll mientras corre el preloader
    lenis.stop();
  }

  /* Enlaces ancla con scroll suave */
  function initAnchorLinks() {
    qsa('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href');
        if (!id || id === '#') {
          e.preventDefault();
          scrollToTop();
          return;
        }
        const target = qs(id);
        if (!target) return;
        e.preventDefault();
        if (lenis) {
          lenis.scrollTo(target, { offset: 0, duration: 1.2 });
        } else {
          target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
        }
      });
    });
  }

  function scrollToTop() {
    if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  /* ============ 3. CURSOR PERSONALIZADO ============ */
  function initCursor() {
    const dot = qs('.cursor-dot');
    const ring = qs('.cursor-ring');
    // Solo en escritorio con puntero fino (en mobile se usa el nativo)
    if (!dot || !ring || TOUCH) return;

    document.documentElement.classList.add('has-cursor');

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      // El punto sigue al mouse de forma instantánea
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      dot.style.opacity = '1';
      ring.style.opacity = '1';
    });

    // Estado hover sobre elementos interactivos (delegación)
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('a, button, .hover-target')) ring.classList.add('is-active');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('a, button, .hover-target')) ring.classList.remove('is-active');
    });

    // Feedback al hacer click
    document.addEventListener('mousedown', () => ring.classList.add('is-down'));
    document.addEventListener('mouseup', () => ring.classList.remove('is-down'));

    // Oculta el cursor al salir de la ventana
    document.documentElement.addEventListener('mouseleave', () => {
      dot.style.opacity = '0';
      ring.style.opacity = '0';
    });

    // El círculo persigue al punto con interpolación (lerp 0.15)
    (function loop() {
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ============ 4. THREE.JS — ESCENA 3D ============ */
  function initThree() {
    if (!HAS_THREE) return;
    const canvas = qs('#webgl-canvas');
    if (!canvas) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: !TOUCH,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      return; // WebGL no disponible: la página funciona igual sin 3D
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // look cinematográfico
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050505, 5, 14); // profundidad / niebla

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 6);

    /* --- Iluminación --- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    const keyLight = new THREE.DirectionalLight(0xc9a96e, 1.9); // key dorado
    keyLight.position.set(4, 3, 5);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x8b7340, 1.15); // rim dorado oscuro
    rimLight.position.set(-5, -2, -4);
    scene.add(rimLight);

    const frontLight = new THREE.PointLight(0xffffff, 0.7, 30); // frontal blanco
    frontLight.position.set(0, 0.5, 5.5);
    scene.add(frontLight);

    /* --- Geometría: pistón diésel + wireframe naranja --- */
    // En mobile se reducen segmentos radiales para mantener 60fps
    const material = new THREE.MeshStandardMaterial({
      color: 0x111111, // negro metálico
      metalness: 1,
      roughness: 0.15,
    });

    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xc9a96e,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });

    /* Construye el pistón con primitivas (corona, anillos, falda,
       pasador, biela y cabeza de biela). Cada pieza comparte su
       geometría con un clon en wireframe para el look de malla. */
    function buildPiston() {
      const seg = TOUCH ? 36 : 64;  // segmentos radiales de cilindros
      const tSeg = TOUCH ? 10 : 14; // segmentos del tubo de los toros
      const piston = new THREE.Group();

      // Añade sólido + wireframe compartiendo la misma geometría
      const addPart = (geometry, x, y, z, rx, ry, rz) => {
        const solid = new THREE.Mesh(geometry, material);
        const wire = new THREE.Mesh(geometry, wireMaterial);
        wire.scale.setScalar(1.002); // evita z-fighting con la malla sólida
        [solid, wire].forEach((mesh) => {
          mesh.position.set(x, y, z);
          mesh.rotation.set(rx || 0, ry || 0, rz || 0);
          piston.add(mesh);
        });
      };

      // Corona del pistón
      addPart(new THREE.CylinderGeometry(1.05, 1.05, 0.85, seg), 0, 1.2, 0);
      // Anillos de compresión (3)
      const ringGeo = new THREE.TorusGeometry(1.07, 0.05, tSeg, seg);
      addPart(ringGeo, 0, 1.42, 0, Math.PI / 2, 0, 0);
      addPart(ringGeo, 0, 1.24, 0, Math.PI / 2, 0, 0);
      addPart(ringGeo, 0, 1.06, 0, Math.PI / 2, 0, 0);
      // Falda
      addPart(new THREE.CylinderGeometry(0.98, 0.92, 0.95, seg), 0, 0.3, 0);
      // Pasador (eje horizontal)
      addPart(
        new THREE.CylinderGeometry(0.17, 0.17, 2.0, TOUCH ? 16 : 24),
        0, 0.55, 0, 0, 0, Math.PI / 2
      );
      // Vástago de la biela (ligeramente cónico)
      addPart(
        new THREE.CylinderGeometry(0.14, 0.24, 2.1, TOUCH ? 16 : 24),
        0, -1.05, 0
      );
      // Cabeza de biela (aro) + muñón del cigüeñal
      addPart(
        new THREE.TorusGeometry(0.52, 0.17, tSeg, seg),
        0, -2.25, 0, 0, Math.PI / 2, 0
      );
      addPart(
        new THREE.CylinderGeometry(0.34, 0.34, 0.6, TOUCH ? 16 : 24),
        0, -2.25, 0, 0, 0, Math.PI / 2
      );

      // Compensa proporciones: centra y escala el conjunto
      piston.scale.setScalar(0.9);
      piston.position.y = 0.55;
      return piston;
    }

    // Grupo interno: rotación constante / Grupo externo: posición y escala
    const spinner = new THREE.Group();
    spinner.add(buildPiston());
    const rig = new THREE.Group();
    rig.add(spinner);
    scene.add(rig);

    /* --- Estado animable + escala base según viewport --- */
    const state = {
      x: 0,
      scale: 1,
      rotX: 0,
      rotY: 0,
      camX: 0,
      camY: 0,
      camTX: 0, // targets de paralaje (mouse)
      camTY: 0,
    };
    let baseScale = 1;

    function fit() {
      const aspect = window.innerWidth / window.innerHeight;
      // Ajusta el tamaño del objeto a pantallas angostas
      baseScale = TOUCH ? Math.min(0.72, aspect * 1.05) : Math.min(1, aspect * 0.9);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    fit();
    window.addEventListener('resize', fit);

    // Paralaje sutil de cámara con el mouse (solo escritorio)
    if (!TOUCH) {
      window.addEventListener('mousemove', (e) => {
        state.camTX = (e.clientX / window.innerWidth - 0.5) * 0.55;
        state.camTY = (e.clientY / window.innerHeight - 0.5) * 0.35;
      });
    }

    /* --- Progreso del scroll (0→1) con scrub 1.5 --- */
    if (HAS_GSAP && HAS_ST) {
      gsap.to(webglState, {
        progress: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5, // suaviza el progreso del scroll
        },
      });
    } else {
      window.addEventListener(
        'scroll',
        () => {
          const max = document.body.scrollHeight - window.innerHeight;
          webglState.progress = max > 0 ? window.scrollY / max : 0;
        },
        { passive: true }
      );
    }

    /* --- Loop de animación --- */
    const clock = new THREE.Clock();
    const LERP = 0.08; // interpolación suave de posición/escala

    function tick() {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const p = webglState.progress;

      /* Objetivos por sección del scroll:
         0–33%  → rotación 360° en Y, X = 0,    escala 1
         33–66% → X = +2.5, escala 1.3, rotación extra
         66–100%→ X = −2.5, escala 0.8 */
      let targetX = 0;
      let targetScale = 1;
      let extraRotY = 0;

      if (p < 1 / 3) {
        const t = p * 3;
        extraRotY = t * Math.PI * 2;
      } else if (p < 2 / 3) {
        const t = (p - 1 / 3) * 3;
        extraRotY = Math.PI * 2 + t * Math.PI;
        targetX = t * 2.5;
        targetScale = 1 + t * 0.3;
      } else {
        const t = (p - 2 / 3) * 3;
        extraRotY = Math.PI * 3 + t * Math.PI * 1.5;
        targetX = 2.5 - t * 5; // de +2.5 a −2.5
        targetScale = 1.3 - t * 0.5; // de 1.3 a 0.8
      }

      // Interpolación suave hacia los objetivos
      state.x += (targetX - state.x) * LERP;
      state.scale += (targetScale - state.scale) * LERP;

      // Rotación constante automática (X e Y) — pausada para leer la silueta
      if (!REDUCED) {
        state.rotX += dt * 0.16;
        state.rotY += dt * 0.24;
      }

      spinner.rotation.x = state.rotX;
      spinner.rotation.y = state.rotY + extraRotY;

      rig.position.x = state.x * baseScale;
      rig.scale.setScalar(state.scale * baseScale);

      // El wireframe gana presencia con el scroll
      wireMaterial.opacity = 0.15 + p * 0.45;

      // Paralaje de cámara
      state.camX += (state.camTX - state.camX) * 0.05;
      state.camY += (state.camTY - state.camY) * 0.05;
      camera.position.x = state.camX;
      camera.position.y = -state.camY;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    tick();
  }

  /* ============ 5. PRELOADER ============ */
  function runPreloader(onComplete) {
    const preloader = qs('#preloader');
    if (!preloader) {
      onComplete();
      return;
    }

    // Sin GSAP o con movimiento reducido: salida inmediata
    if (!HAS_GSAP || REDUCED) {
      preloader.style.display = 'none';
      onComplete();
      return;
    }

    const percentEl = qs('#preloader-percent');
    const counter = { v: 0 };

    const tl = gsap.timeline({ onComplete });

    tl
      // Letras una por una (stagger 0.05)
      .from(
        '.preloader__letter',
        { yPercent: 130, duration: 0.9, ease: 'power4.out', stagger: 0.05 },
        0.15
      )
      .from('.preloader__tagline', { opacity: 0, y: 12, duration: 0.6 }, 0.55)
      // La barra se llena en 1.5s sincronizada con el porcentaje
      .to('#preloader-bar-fill', { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }, 0.35)
      .to(
        counter,
        {
          v: 100,
          duration: 1.5,
          ease: 'power2.inOut',
          onUpdate: () => {
            if (percentEl) percentEl.textContent = String(Math.round(counter.v)).padStart(2, '0');
          },
        },
        0.35
      )
      // Salida hacia arriba (power4.inOut)
      .to('.preloader__inner', { yPercent: -35, opacity: 0, duration: 0.5, ease: 'power3.in' }, '+=0.15')
      .to(preloader, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.15')
      .set(preloader, { display: 'none' });
  }

  /* ============ 6. ANIMACIONES DE ENTRADA (HERO) ============ */
  function initHeroAnimations() {
    if (!HAS_GSAP || REDUCED) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.9 } });

    tl.from('.nav', { y: -26, opacity: 0, duration: 0.7 }, 0)
      .from('.hero__meta-item', { y: 22, opacity: 0, stagger: 0.09 }, 0.05)
      // Líneas del H1 desde abajo, stagger 0.15
      .from(
        '.hero__line-inner',
        { yPercent: 118, duration: 1.15, ease: 'power4.out', stagger: 0.15 },
        0.15
      )
      .from('.hero__desc', { y: 28, opacity: 0 }, '-=0.65')
      .from('.hero__scroll', { y: 16, opacity: 0, duration: 0.7 }, '-=0.6')
      .from(
        '.hero__badge',
        { opacity: 0, scale: 0.7, duration: 0.9, ease: 'back.out(1.6)' },
        '-=0.7'
      );
  }

  /* ============ 7. SCROLLTRIGGER POR SECCIONES ============ */
  function initSectionAnimations() {
    if (!HAS_GSAP || !HAS_ST) return;

    const mm = gsap.matchMedia();

    /* --- Details: sección sticky (solo escritorio) --- */
    mm.add('(min-width: 1024px)', () => {
      if (REDUCED) return;

      // Pin del contenido: la sección ocupa ~300vh de scroll
      ScrollTrigger.create({
        trigger: '.details',
        start: 'top top',
        end: '+=200%',
        pin: '.details__pin',
      });

      // La ficha técnica se revela progresivamente durante el pin
      gsap.from('.details__specs li', {
        y: 28,
        opacity: 0,
        stagger: 0.14,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.details',
          start: 'top top',
          end: '+=170%',
          scrub: 0.6,
        },
      });

      gsap.from('.details__aside-index', {
        opacity: 0,
        y: 16,
        scrollTrigger: {
          trigger: '.details',
          start: 'top top',
          end: '+=60%',
          scrub: 0.6,
        },
      });
    });

    if (!REDUCED) {
      /* --- Details: contenido entra desde la izquierda --- */
      gsap.from('.details__content > *', {
        x: -60,
        opacity: 0,
        stagger: 0.1,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.details',
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      });

      /* --- Stats: stagger desde abajo --- */
      gsap.from('.stat', {
        y: 46,
        opacity: 0,
        stagger: 0.1,
        duration: 0.85,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.details__stats',
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      });

      /* --- Services: marquee + tarjetas --- */
      gsap.from('.marquee', {
        opacity: 0,
        duration: 0.9,
        scrollTrigger: {
          trigger: '.services',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      gsap.from('.services__head, .services__intro', {
        y: 40,
        opacity: 0,
        stagger: 0.1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.services__inner',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      gsap.from('.service-card', {
        y: 80,
        opacity: 0,
        stagger: 0.12,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.services__grid',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      /* --- Inventario: chips en cascada --- */
      gsap.from('.inventory .label, .inventory__title, .inventory__text', {
        y: 34,
        opacity: 0,
        stagger: 0.09,
        duration: 0.85,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.inventory',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
      });

      gsap.from('.chip', {
        y: 24,
        opacity: 0,
        stagger: 0.05,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.inventory__chips',
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      });

      /* --- Footer: CTA + columnas --- */
      gsap.from('.footer__cta-link', {
        y: 70,
        opacity: 0,
        duration: 1.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.footer__cta',
          start: 'top 82%',
          toggleActions: 'play none none reverse',
        },
      });

      gsap.from('.footer__col', {
        y: 38,
        opacity: 0,
        stagger: 0.08,
        duration: 0.85,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.footer__grid',
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      });
    }

    /* --- Contadores de stats (una sola vez) --- */
    ScrollTrigger.create({
      trigger: '.details__stats',
      start: 'top 85%',
      once: true,
      onEnter: animateCounters,
    });

    /* --- Nav: blur al hacer scroll --- */
    ScrollTrigger.create({
      start: 90,
      end: 999999,
      toggleClass: { targets: '.nav', className: 'nav--scrolled' },
    });
  }

  /* Contadores numéricos de la sección Details */
  function animateCounters() {
    qsa('.stat__num').forEach((el) => {
      const target = parseInt(el.dataset.count, 10) || 0;

      if (!HAS_GSAP || REDUCED) {
        el.textContent = target;
        return;
      }

      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.8,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = Math.round(obj.v);
        },
      });
    });
  }

  /* ============ 8. ARRANQUE ============ */
  function startExperience() {
    if (lenis) lenis.start(); // libera el scroll tras el preloader
    initHeroAnimations();
    initSectionAnimations();
    if (HAS_ST) ScrollTrigger.refresh();
  }

  /* ============ 9. HAMBURGER MENU ============ */
  function initHamburger() {
    const burger = qs('#nav-burger');
    const nav = qs('#nav');
    if (!burger || !nav) return;

    burger.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('nav--open');
      burger.setAttribute('aria-expanded', isOpen);
      document.body.classList.toggle('chat-open', isOpen);
    });

    // Cerrar al hacer click en un enlace del menú
    qsa('.nav__mobile-link').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('nav--open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('chat-open');
      });
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('nav--open')) {
        nav.classList.remove('nav--open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('chat-open');
      }
    });
  }

  /* ============ 10. CHATBOT ASISTENTE IA ============ */
  function initChatbot() {
    const chatbot = qs('#chatbot');
    const toggle = qs('#chatbot-toggle');
    const close = qs('#chatbot-close');
    const form = qs('#chatbot-form');
    const input = qs('#chatbot-input');
    const messages = qs('#chatbot-messages');
    if (!chatbot || !toggle || !form || !input || !messages) return;

    const responses = {
      'bomba': 'Trabajamos con bombas Common Rail y rotativas para todo tipo de equipo. Ofrecemos reparación, calibración y venta con garantía. ¿Desea agendar una revisión?',
      'inyector': 'Reparamos y vendemos inyectores piezo y solenoide para las principales marcas: Cummins, Caterpillar, Duramax, Power Stroke, Hino, Isuzu y más.',
      'turbo': 'Contamos con turbos new y remanufacturados. Hacemos instalación y prueba post-instalación. ¿Qué plataforma le interesa?',
      'precio': 'Los precios varían según el modelo y marca del equipo. Para una cotización precisa, necesita traer el equipo al taller o enviar datos por WhatsApp al +506 8531-0000.',
      'cita': 'Puede agendar una cita al +506 8531-0000 o por WhatsApp. Atendemos de Lunes a Viernes de 7:30 a 17:00 y Sábados de 8:00 a 12:00.',
      'horario': 'Horario: Lunes a Viernes 7:30 – 17:00, Sábados 8:00 – 12:00. Domingos cerrado.',
      'whatsapp': 'Puede contactarnos por WhatsApp al +506 8531-0000. ¡Le atendemos rápido!',
      'ubicacion': 'Estamos en 300 metros sur de Super Compro de Santa Rosa, Santo Domingo, Heredia, Costa Rica. Código postal 40306.',
      'direccion': 'Estamos en 300 metros sur de Super Compro de Santa Rosa, Santo Domingo, Heredia, Costa Rica. Código postal 40306.',
      'servicio': 'Ofrecemos: reparación de bombas de inyección, venta e instalación de inyectores, turbos new y remanufacturados, y diagnóstico computarizado.',
      'gracias': '¡Con gusto! Si necesita algo más, estoy aquí 24/7. ¡Que tenga un excelente día!',
      'hola': '¡Hola! Bienvenido a Repuestos América Diesel. ¿En qué puedo ayudarle?',
      'buenas': '¡Buenas! ¿Cómo puedo asistirle hoy? Pregunte por bombas, inyectores, turbos o agendar una cita.'
    };

    function addMessage(text, isUser) {
      const div = document.createElement('div');
      div.className = `chatbot__msg chatbot__msg--${isUser ? 'user' : 'bot'}`;
      div.innerHTML = `<p>${text}</p>`;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function getResponse(input) {
      const lower = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const [key, val] of Object.entries(responses)) {
        if (lower.includes(key)) return val;
      }
      return 'Gracias por su consulta. Para información específica, comuníquese al +506 8531-0000 o escríbanos por WhatsApp. ¡Con gusto le ayudamos!';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, true);
      input.value = '';
      // Simula delay de "escribiendo..."
      setTimeout(() => addMessage(getResponse(text), false), 600 + Math.random() * 800);
    });

    toggle.addEventListener('click', () => {
      chatbot.classList.toggle('chatbot--open');
    });

    close.addEventListener('click', () => {
      chatbot.classList.remove('chatbot--open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chatbot.classList.contains('chatbot--open')) {
        chatbot.classList.remove('chatbot--open');
      }
    });
  }

  function init() {
    initLenis();
    initAnchorLinks();
    initCursor();
    initThree();
    initHamburger();
    initChatbot();
    runPreloader(startExperience);

    // Recalcula triggers cuando fuentes e imágenes terminen de cargar
    window.addEventListener('load', () => {
      if (HAS_ST) ScrollTrigger.refresh();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (HAS_ST) ScrollTrigger.refresh();
      });
    }
  }

  // El script va al final del body: el DOM ya está listo
  init();
})();
