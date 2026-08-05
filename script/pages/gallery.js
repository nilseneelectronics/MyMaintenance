document.addEventListener('DOMContentLoaded', () => {
    const bigPhotoContainer = document.getElementById('big-photo-container');
    if (!bigPhotoContainer) return;

    const defaultImages = [
        'https://picsum.photos/id/1015/1200/675',
        'https://picsum.photos/id/1016/1200/675',
        'https://picsum.photos/id/1018/1200/675',
        'https://picsum.photos/id/102/1200/675',
        'https://picsum.photos/id/201/1200/675'
    ];

    const defaultPhotos = (Array.isArray(window.GALLERY_IMAGES) && window.GALLERY_IMAGES.length ? window.GALLERY_IMAGES : defaultImages)
        .map((src) => ({ src, text: '' }));

    const STORAGE_KEY = window.GALLERY_STORAGE_KEY || 'floorplan_home_photos';
    const OVERRIDES_KEY = STORAGE_KEY + '_overrides';

    function loadStoredPhotos() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return [];
    }
    function saveStoredPhotos() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storedPhotos));
    }
    function loadOverrides() {
        try {
            const saved = localStorage.getItem(OVERRIDES_KEY);
            if (saved) return JSON.parse(saved);
        } catch (_) {}
        return {};
    }
    function saveOverrides() {
        localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    }

    let storedPhotos = loadStoredPhotos();
    let overrides = loadOverrides();

    function buildPhotos() {
        const visibleDefaults = defaultPhotos
            .filter((p) => !overrides[p.src] || !overrides[p.src].removed)
            .map((p) => ({ src: p.src, text: (overrides[p.src] && overrides[p.src].text) || p.text }));
        return visibleDefaults.concat(storedPhotos);
    }
    let photos = buildPhotos();

    let currentIndex = 0;
    let galleryEditMode = false;
    let fullscreenFromGallery = false;
    let fullscreenEditMode = false;
    let editingPhotoIndex = null;

    const mainImg = document.getElementById('main-home-photo');
    const modal = document.getElementById('photo-modal');
    const modalImg = document.getElementById('modal-photo');
    const modalCaption = document.getElementById('modal-photo-caption');
    const photoTextInput = document.getElementById('modal-photo-text');
    const prevArrow = document.getElementById('prev-arrow');
    const nextArrow = document.getElementById('next-arrow');
    const closeModalButton = document.getElementById('close-modal');
    const modalPrev = document.getElementById('modal-prev');
    const modalNext = document.getElementById('modal-next');
    const modalEditButton = document.getElementById('modal-edit');
    const modalDeleteButton = document.getElementById('modal-delete');

    const deletePopup = document.getElementById('delete-photo-popup');
    const dpCancel = document.getElementById('dp-cancel');
    const dpDelete = document.getElementById('dp-delete');

    const viewAllButton = document.getElementById('view-all-photos');
    const galleryModal = document.getElementById('gallery-modal');
    const galleryGrid = document.getElementById('gallery-grid');
    const galleryClose = document.getElementById('gallery-close');
    const galleryAddPhoto = document.getElementById('gallery-add-photo');
    const galleryEditPhoto = document.getElementById('gallery-edit-photo');
    const addPhotoButton = document.getElementById('add-photo-btn');

    const addPopup = document.getElementById('add-photos-popup');
    const apNoPhotos = document.getElementById('ap-no-photos');
    const apGrid = document.getElementById('ap-photo-grid');
    const apPictureBtn = document.getElementById('ap-picture-btn');
    const apPhotoOptions = document.getElementById('ap-photo-options');
    const apCancel = document.getElementById('ap-cancel');
    const apSave = document.getElementById('ap-save');

    const editPopup = document.getElementById('ap-edit-popup');
    const apEditText = document.getElementById('ap-edit-text');
    const apEditCancel = document.getElementById('ap-edit-cancel');
    const apEditSave = document.getElementById('ap-edit-save');
    const apEditDelete = document.getElementById('ap-edit-delete');

    let pendingPhotos = [];

    function getPhoto(index) {
        return photos[(index + photos.length) % photos.length];
    }

    function updateCaption() {
        if (!modalCaption) return;
        modalCaption.textContent = getPhoto(currentIndex).text || '';
    }

    function enterFullscreenEdit() {
        fullscreenEditMode = true;
        if (photoTextInput) {
            photoTextInput.value = getPhoto(currentIndex).text || '';
            photoTextInput.style.display = '';
        }
        if (modalCaption) modalCaption.style.display = 'none';
        if (modalEditButton) modalEditButton.textContent = 'Save';
        if (modalDeleteButton) modalDeleteButton.style.display = 'inline-flex';
    }

    function exitFullscreenEdit() {
        fullscreenEditMode = false;
        if (photoTextInput) photoTextInput.style.display = 'none';
        if (modalCaption) modalCaption.style.display = '';
        if (modalEditButton) modalEditButton.textContent = 'Edit';
        if (modalDeleteButton) modalDeleteButton.style.display = 'none';
        updateCaption();
    }

    function saveFullscreenEdit() {
        const text = photoTextInput ? photoTextInput.value.trim() : '';
        persistPhoto(currentIndex, text);
        exitFullscreenEdit();
    }

    function showModalPhoto(index) {
        currentIndex = (index + photos.length) % photos.length;
        if (modalImg) modalImg.src = photos[currentIndex].src;
        updateCaption();
        if (fullscreenEditMode && photoTextInput && photos.length) photoTextInput.value = photos[currentIndex].text || '';
    }

    function setPhoto(index) {
        currentIndex = (index + photos.length) % photos.length;
        if (mainImg) mainImg.src = photos[currentIndex].src;
    }

    function openFullscreen(index, fromGallery) {
        fullscreenFromGallery = !!fromGallery;
        fullscreenEditMode = false;
        currentIndex = (index + photos.length) % photos.length;
        if (modalImg) modalImg.src = photos[currentIndex].src;
        updateCaption();
        if (modal) modal.classList.add('active');
    }

    function closeFullscreen() {
        if (fullscreenEditMode) {
            exitFullscreenEdit();
            if (modal) modal.classList.remove('active');
            if (galleryModal) galleryModal.classList.remove('active');
            fullscreenFromGallery = false;
            return;
        }
        if (modal) modal.classList.remove('active');
        fullscreenFromGallery = false;
    }

    function renderGallery() {
        if (!galleryGrid) return;
        galleryGrid.innerHTML = '';
        photos.forEach((photo, i) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'gallery-thumb' + (galleryEditMode ? ' gallery-edit-mode' : '');
            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = 'Photo ' + (i + 1);
            cell.appendChild(img);

            if (galleryEditMode) {
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'gallery-del';
                del.setAttribute('aria-label', 'Delete photo');
                del.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M256-200q-23.53 0-40.26-16.74Q199-233.47 199-257v-483h-13v-60h188v-30h212v30h188v60h-13v483q0 23.53-16.74 40.26Q716.53-200 693-200H256Zm103-100h60v-336h-60v336Zm182 0h60v-336h-60v336Z"/></svg>';
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deletePhoto(i);
                });
                cell.appendChild(del);
                cell.addEventListener('click', () => openEditPhoto(i));
            } else {
                cell.addEventListener('click', () => {
                    openFullscreen(i, true);
                });
            }
            galleryGrid.appendChild(cell);
        });
    }

    function openGallery() {
        if (!galleryModal) return;
        renderGallery();
        galleryModal.classList.add('active');
    }

    function closeGallery() {
        if (galleryEditMode) {
            galleryEditMode = false;
            if (galleryEditPhoto) galleryEditPhoto.classList.remove('active');
        }
        if (galleryModal) galleryModal.classList.remove('active');
    }

    function persistPhoto(i, text) {
        if (i == null || !photos[i]) return;
        const photo = photos[i];
        const isDefault = defaultPhotos.some((p) => p.src === photo.src);
        if (isDefault) {
            overrides[photo.src] = Object.assign({}, overrides[photo.src], { text: text });
            saveOverrides();
        } else {
            const si = storedPhotos.findIndex((p) => p.src === photo.src);
            if (si >= 0) {
                storedPhotos[si].text = text;
                saveStoredPhotos();
            }
        }
        photos = buildPhotos();
        renderGallery();
    }

    function deletePhoto(i) {
        const photo = photos[i];
        const isDefault = defaultPhotos.some((p) => p.src === photo.src);
        if (isDefault) {
            overrides[photo.src] = { removed: true };
            saveOverrides();
        } else {
            const si = storedPhotos.findIndex((p) => p.src === photo.src);
            if (si >= 0) {
                storedPhotos.splice(si, 1);
                saveStoredPhotos();
            }
        }
        photos = buildPhotos();
        renderGallery();
        if (modal && modal.classList.contains('active')) {
            if (photos.length === 0) {
                if (modal) modal.classList.remove('active');
                if (galleryModal) galleryModal.classList.remove('active');
                fullscreenFromGallery = false;
                fullscreenEditMode = false;
            } else {
                currentIndex = Math.min(currentIndex, photos.length - 1);
                showModalPhoto(currentIndex);
            }
        }
    }

    function openEditPhoto(i) {
        editingPhotoIndex = i;
        if (apEditText) apEditText.value = photos[i].text || '';
        if (editPopup) editPopup.style.display = 'flex';
    }

    function closeEditPhoto() {
        if (editPopup) editPopup.style.display = 'none';
        editingPhotoIndex = null;
    }

    function saveEditPhoto() {
        if (editingPhotoIndex == null) return;
        const text = apEditText ? apEditText.value.trim() : '';
        persistPhoto(editingPhotoIndex, text);
        closeEditPhoto();
        renderGallery();
        if (modal && modal.classList.contains('active')) updateCaption();
    }

    function renderPendingPhotos() {
        if (!apGrid) return;
        apGrid.innerHTML = '';
        if (apNoPhotos) apNoPhotos.style.display = pendingPhotos.length ? 'none' : 'block';
        pendingPhotos.forEach((photo, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'done-photo-thumb';

            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = 'Picture ' + (i + 1);

            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'photo-remove';
            rm.setAttribute('aria-label', 'Remove picture');
            rm.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M256-200q-23.53 0-40.26-16.74Q199-233.47 199-257v-483h-13v-60h188v-30h212v30h188v60h-13v483q0 23.53-16.74 40.26Q716.53-200 693-200H256Zm103-100h60v-336h-60v336Zm182 0h60v-336h-60v336Z"/></svg>';
            rm.addEventListener('click', () => {
                pendingPhotos.splice(i, 1);
                renderPendingPhotos();
            });

            const txt = document.createElement('input');
            txt.type = 'text';
            txt.className = 'ap-photo-text';
            txt.placeholder = 'Photo text...';
            txt.value = photo.text || '';
            txt.addEventListener('input', () => { photo.text = txt.value; });

            wrap.appendChild(img);
            wrap.appendChild(rm);
            wrap.appendChild(txt);
            apGrid.appendChild(wrap);
        });
    }

    function openAddPhotos() {
        if (!addPopup) return;
        pendingPhotos = [];
        if (apPhotoOptions) apPhotoOptions.style.display = 'none';
        renderPendingPhotos();
        addPopup.style.display = 'flex';
    }

    function closeAddPhotos() {
        if (addPopup) addPopup.style.display = 'none';
        pendingPhotos = [];
    }

    function toggleEditMode() {
        galleryEditMode = !galleryEditMode;
        if (galleryEditPhoto) galleryEditPhoto.classList.toggle('active', galleryEditMode);
        renderGallery();
    }

    if (prevArrow) prevArrow.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        setPhoto(currentIndex - 1);
    });

    if (nextArrow) nextArrow.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        setPhoto(currentIndex + 1);
    });

    if (mainImg) mainImg.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        openFullscreen(currentIndex, false);
    });

    if (closeModalButton) closeModalButton.addEventListener('click', closeFullscreen);

    if (modalPrev) modalPrev.addEventListener('click', () => {
        showModalPhoto(currentIndex - 1);
    });

    if (modalNext) modalNext.addEventListener('click', () => {
        showModalPhoto(currentIndex + 1);
    });

    if (modalEditButton) modalEditButton.addEventListener('click', () => {
        if (fullscreenEditMode) {
            saveFullscreenEdit();
        } else {
            enterFullscreenEdit();
        }
    });

    if (modalDeleteButton) modalDeleteButton.addEventListener('click', () => {
        if (deletePopup) deletePopup.style.display = 'flex';
    });

    if (dpCancel) dpCancel.addEventListener('click', () => {
        if (deletePopup) deletePopup.style.display = 'none';
    });

    if (dpDelete) dpDelete.addEventListener('click', () => {
        if (deletePopup) deletePopup.style.display = 'none';
        const idx = currentIndex;
        exitFullscreenEdit();
        deletePhoto(idx);
    });

    if (modalImg) modalImg.addEventListener('click', (e) => {
        const rect = modalImg.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
            showModalPhoto(currentIndex - 1);
        } else {
            showModalPhoto(currentIndex + 1);
        }
    });

    if (viewAllButton) viewAllButton.addEventListener('click', openGallery);
    if (galleryClose) galleryClose.addEventListener('click', closeGallery);
    if (galleryAddPhoto) galleryAddPhoto.addEventListener('click', openAddPhotos);
    if (galleryEditPhoto) galleryEditPhoto.addEventListener('click', toggleEditMode);
    if (addPhotoButton) addPhotoButton.addEventListener('click', openAddPhotos);

    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeFullscreen(); });
    if (galleryModal) galleryModal.addEventListener('click', (e) => { if (e.target === galleryModal) closeGallery(); });
    if (addPopup) addPopup.addEventListener('click', (e) => { if (e.target === addPopup) closeAddPhotos(); });
    if (editPopup) editPopup.addEventListener('click', (e) => { if (e.target === editPopup) closeEditPhoto(); });
    if (deletePopup) deletePopup.addEventListener('click', (e) => { if (e.target === deletePopup) { deletePopup.style.display = 'none'; } });

    if (apEditCancel) apEditCancel.addEventListener('click', closeEditPhoto);
    if (apEditSave) apEditSave.addEventListener('click', saveEditPhoto);
    if (apEditDelete) apEditDelete.addEventListener('click', () => {
        if (editingPhotoIndex == null) return;
        const idx = editingPhotoIndex;
        closeEditPhoto();
        deletePhoto(idx);
    });

    if (apPictureBtn) {
        apPictureBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            apPhotoOptions.style.display = apPhotoOptions.style.display === 'grid' ? 'none' : 'grid';
        });
    }
    if (apPhotoOptions) {
        apPhotoOptions.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-source]');
            if (!btn) return;
            apPhotoOptions.style.display = 'none';
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            if (btn.dataset.source === 'camera') {
                fileInput.accept = 'image/*';
                fileInput.setAttribute('capture', 'environment');
            } else if (btn.dataset.source === 'library') {
                fileInput.accept = 'image/*';
            }
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            fileInput.addEventListener('change', () => {
                const files = fileInput.files ? Array.from(fileInput.files) : [];
                fileInput.remove();
                if (files.length === 0) return;
                const readers = files.map((file) => new Promise((resolve) => {
                    const r = new FileReader();
                    r.onload = () => resolve(r.result);
                    r.readAsDataURL(file);
                }));
                Promise.all(readers).then((results) => {
                    pendingPhotos = pendingPhotos.concat(results.map((src) => ({ src, text: '' })));
                    renderPendingPhotos();
                });
            });
            fileInput.click();
        });
    }

    if (apCancel) apCancel.addEventListener('click', closeAddPhotos);
    if (apSave) apSave.addEventListener('click', () => {
        if (pendingPhotos.length === 0) {
            alert('Please add at least one picture.');
            return;
        }
        storedPhotos = storedPhotos.concat(pendingPhotos);
        saveStoredPhotos();
        photos = buildPhotos();
        closeAddPhotos();
        openGallery();
    });

    document.addEventListener('keydown', (event) => {
        if (deletePopup && deletePopup.style.display === 'flex') {
            if (event.key === 'Escape') deletePopup.style.display = 'none';
        } else if (modal && modal.classList.contains('active')) {
            if (event.key === 'Escape') {
                if (fullscreenEditMode) exitFullscreenEdit();
                else closeFullscreen();
            }
            if (event.key === 'Enter' && fullscreenEditMode) saveFullscreenEdit();
            if (event.key === 'ArrowLeft') showModalPhoto(currentIndex - 1);
            if (event.key === 'ArrowRight') showModalPhoto(currentIndex + 1);
        } else if (galleryModal && galleryModal.classList.contains('active')) {
            if (event.key === 'Escape') closeGallery();
        } else if (editPopup && editPopup.style.display === 'flex') {
            if (event.key === 'Escape') closeEditPhoto();
        } else if (addPopup && addPopup.style.display === 'flex') {
            if (event.key === 'Escape') closeAddPhotos();
        }
    });
});
