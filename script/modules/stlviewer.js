/* My3dViewer - built-in 3D viewer for STL / 3MF models built on Three.js.
   Lazy-loads a prebundled classic script (script/vendor/three-bundle.js) on
   first use, following the same pattern as MyPdfViewer. */
window.My3dViewer = (function () {
    'use strict';

    var VENDOR = (function () {
        var src = '';
        try {
            if (document.currentScript) src = document.currentScript.src;
        } catch (_) {}
        return src ? new URL('../vendor/', src).href : '../script/vendor/';
    })();

    var bundlePromise = null;
    var THREE = null;
    var STLLoader = null;
    var ThreeMFLoader = null;
    var OrbitControls = null;

    var container = null;
    var renderer = null;
    var scene = null;
    var camera = null;
    var controls = null;
    var animId = null;
    var resizeObserver = null;

    function attachBundle(bundle) {
        THREE = bundle.THREE;
        STLLoader = bundle.STLLoader;
        ThreeMFLoader = bundle.ThreeMFLoader;
        OrbitControls = bundle.OrbitControls;
    }

    function loadBundle() {
        if (bundlePromise) return bundlePromise;
        bundlePromise = new Promise(function (resolve, reject) {
            if (window.My3dBundle) {
                attachBundle(window.My3dBundle);
                resolve();
                return;
            }
            var s = document.createElement('script');
            s.src = VENDOR + 'three-bundle.js';
            s.onload = function () {
                if (!window.My3dBundle) { reject(new Error('3D viewer failed to initialize')); return; }
                attachBundle(window.My3dBundle);
                resolve();
            };
            s.onerror = function () { reject(new Error('Could not load the 3D viewer')); };
            document.head.appendChild(s);
        });
        return bundlePromise;
    }

    function dataUrlToArrayBuffer(dataUrl) {
        var parts = String(dataUrl).split(',');
        if (parts.length < 2) throw new Error('Unsupported data format');
        var bin = atob(parts[1]);
        var out = new ArrayBuffer(bin.length);
        var view = new Uint8Array(out);
        for (var i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
        return out;
    }

    function buildScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x14171a);
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        var key = new THREE.DirectionalLight(0xffffff, 0.95);
        key.position.set(1, 2.2, 1.4);
        scene.add(key);
        var fill = new THREE.DirectionalLight(0xffffff, 0.35);
        fill.position.set(-1.2, -0.5, -1);
        scene.add(fill);
        camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100000);
    }

    function buildControls() {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.2;
    }

    function animate() {
        animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    function disposeObject(root) {
        root.traverse(function (o) {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                var mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(function (m) {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
            }
        });
    }

    function frameObject(obj) {
        var box = new THREE.Box3().setFromObject(obj);
        if (box.isEmpty()) return;
        var center = box.getCenter(new THREE.Vector3());
        var size = box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z, 1e-6);
        var fov = camera.fov * Math.PI / 180;
        var dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.25;
        camera.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist);
        camera.near = Math.max(dist / 1000, 0.001);
        camera.far = Math.max(dist * 1000, 1000);
        camera.updateProjectionMatrix();
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
    }

    function resize() {
        if (!container || !renderer) return;
        var w = container.clientWidth || 1;
        var h = container.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    function open(dataUrl, fileName, parent, ext) {
        if (!parent) return Promise.reject(new Error('No container'));
        close();
        return loadBundle().then(function () {
            container = document.createElement('div');
            container.className = 'viewer3d-wrap';
            parent.appendChild(container);

            try {
                renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
            } catch (err) {
                throw new Error('WebGL is not supported in this browser');
            }
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            container.appendChild(renderer.domElement);
            buildScene();
            buildControls();
            resize();
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(resize);
                resizeObserver.observe(container);
            }

            var buffer = dataUrlToArrayBuffer(dataUrl);
            var object;
            if (String(ext).toLowerCase() === '3mf') {
                object = new ThreeMFLoader().parse(buffer);
            } else {
                var geometry = new STLLoader().parse(buffer);
                var material = new THREE.MeshStandardMaterial({
                    color: 0x20b2aa,
                    metalness: 0.25,
                    roughness: 0.55,
                    flatShading: true,
                    side: THREE.DoubleSide
                });
                object = new THREE.Mesh(geometry, material);
            }
            scene.add(object);
            frameObject(object);
            animate();
        }).catch(function (err) {
            close();
            var msg = (err && err.message) ? err.message : String(err);
            if (window.console && window.console.error) window.console.error('My3dViewer: ' + msg);
            if (parent) {
                parent.innerHTML = '<div class="preview-note">Could not load 3D model (' + escapeHtml(msg) + '). Use Open or Download below.</div>';
            }
            throw err;
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function close() {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
        if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
        if (controls) { controls.dispose(); controls = null; }
        if (renderer) {
            renderer.dispose();
            try { renderer.forceContextLoss(); } catch (_) {}
            var cv = renderer.domElement;
            if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
            renderer = null;
        }
        if (scene) { disposeObject(scene); scene = null; }
        camera = null;
        if (container) {
            var p = container.parentNode;
            if (p) p.removeChild(container);
            container = null;
        }
    }

    return { open: open, close: close, load: loadBundle };
})();
