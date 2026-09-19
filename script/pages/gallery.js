document.addEventListener('DOMContentLoaded', () => {
    const bigPhotoContainer = document.getElementById('big-photo-container');
    if (!bigPhotoContainer) return;

    // Photos are user content only. Never fill a new asset with sample images.
    const defaultPhotos = [];

    const STORAGE_KEY = window.GALLERY_STORAGE_KEY || 'floorplan_home_photos';
    const OVERRIDES_KEY = STORAGE_KEY + '_overrides';

    const pageParams = new URLSearchParams(window.location.search);
    const assetId = pageParams.get('id') || '';
    const assetType = window.location.pathname.toLowerCase().includes('myvehicles') ? 'vehicle' : 'home';

    function loadStoredPhotos() {
        return [];
    }
    function saveStoredPhotos() {
        // Photos are stored in Supabase Storage, not in browser localStorage.
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
    const apCancel = document.getElementById('ap-cancel');
    const apSave = document.getElementById('ap-save');

    const editPopup = document.getElementById('ap-edit-popup');
    const apEditText = document.getElementById('ap-edit-text');
    const apEditCancel = document.getElementById('ap-edit-cancel');
    const apEditSave = document.getElementById('ap-edit-save');
    const apEditDelete = document.getElementById('ap-edit-delete');

    let pendingPhotos = [];

    function syncPhotoPresentation() {
        const empty = photos.length === 0;
        bigPhotoContainer.classList.toggle('is-empty', empty);
        bigPhotoContainer.classList.toggle('has-multiple-photos', photos.length > 1);
        if (mainImg) {
            mainImg.hidden = empty;
            if (empty) mainImg.removeAttribute('src');
            else mainImg.src = photos[currentIndex].src;
        }
        [prevArrow, nextArrow].forEach((arrow) => { if (arrow) arrow.hidden = photos.length < 2; });
        if (viewAllButton) viewAllButton.hidden = empty;
    }

    function getPhoto(index) {
        return photos[(index + photos.length) % photos.length];
    }

    function updateCaption() {
        if (!modalCaption) return;
        modalCaption.textContent = photos.length ? (getPhoto(currentIndex).text || '') : '';
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
        if (!photos.length) {
            syncPhotoPresentation();
            renderThumbs();
            return;
        }
        currentIndex = (index + photos.length) % photos.length;
        syncPhotoPresentation();
        renderThumbs();
    }

    const thumb1 = document.getElementById('thumb-1');
    const thumb2 = document.getElementById('thumb-2');
    const thumbsWrap = document.getElementById('photo-thumbs');
    const emptyPhotoState = bigPhotoContainer.querySelector('.photo-empty-state');

    function thumbPlaceholder(label) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><svg x="60" y="24" width="60" height="60" viewBox="0 -960 960 960"><path fill="#20B2AA" d="M480-480ZM180-120q-24 0-42-18t-18-42v-600q0-24 18-42t42-18h335q13 0 21.5 8.5T545-810q0 13-8.5 21.5T515-780H180v600h600v-335q0-13 8.5-21.5T810-545q13 0 21.5 8.5T840-515v335q0 24-18 42t-42 18H180Zm60-162h480L576-474 449-307l-94-124-115 149Zm453-410h-58q-13 0-21.5-8.5T605-722q0-13 8.5-21.5T635-752h58v-58q0-13 8.5-21.5T723-840q13 0 21.5 8.5T753-810v58h57q13 0 21.5 8.5T840-722q0 13-8.5 21.5T810-692h-57v57q0 13-8.5 21.5T723-605q-13 0-21.5-8.5T693-635v-57Z"/></svg><text x="90" y="137" text-anchor="middle" fill="#20B2AA" font-family="Arial" font-size="13">${label}</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    // Show the next 2 photos as preview thumbnails; hide when there aren't enough.
    function renderThumbs() {
        if (!thumb1 && !thumb2) return;
        const imgs = [thumb1, thumb2];
        imgs.forEach((img, i) => {
            if (!img) return;
            const has = photos.length > i + 1;
            img.style.display = '';
            if (has) {
                delete img.dataset.photoPlaceholder;
                img.src = photos[(currentIndex + 1 + i) % photos.length].src;
                img.alt = 'More photo';
            } else {
                img.dataset.photoPlaceholder = 'true';
                img.src = thumbPlaceholder(photos.length ? 'Not enough pictures added' : 'No pictures added yet');
                img.alt = 'Add photo';
            }
        });
        if (thumbsWrap) thumbsWrap.style.display = '';
    }

    if (thumbsWrap) {
        thumbsWrap.addEventListener('click', (e) => {
            const t = e.target.closest('img');
            if (!t) return;
            if (t.dataset.photoPlaceholder === 'true') {
                openAddPhotos();
                return;
            }
            setPhoto(currentIndex + (t === thumb2 ? 2 : 1));
        });
    }

    function openFullscreen(index, fromGallery) {
        if (!photos.length) return;
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
        renderThumbs();
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

    async function persistPhoto(i, text) {
        if (i == null || !photos[i]) return;
        const photo = photos[i];
        if (photo.id && window.MyMaintenancePhotos) {
            await window.MyMaintenancePhotos.update(photo.id, text);
            photo.text = text;
        }
        photos = buildPhotos();
        syncPhotoPresentation();
        renderGallery();
    }

    async function deletePhoto(i) {
        const photo = photos[i];
        if (photo && photo.id && window.MyMaintenancePhotos) {
            await window.MyMaintenancePhotos.remove(photo);
            storedPhotos = storedPhotos.filter((p) => p.id !== photo.id);
        }
        photos = buildPhotos();
        syncPhotoPresentation();
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
    if (emptyPhotoState) {
        const addFromEmptyState = () => openAddPhotos();
        emptyPhotoState.addEventListener('click', addFromEmptyState);
        emptyPhotoState.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                addFromEmptyState();
            }
        });
    }

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
        apPictureBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.accept = 'image/*';
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
    if (apSave) apSave.addEventListener('click', async () => {
        if (pendingPhotos.length === 0) {
            window.MyMaintenanceCommonUi.alert('Please add at least one picture.');
            return;
        }
        if (!window.MyMaintenancePhotos || !assetId) {
            window.MyMaintenanceCommonUi.alert('This asset is not ready for photo uploads yet.');
            return;
        }
        try {
            const uploaded = await Promise.all(pendingPhotos.map(async (photo) => {
                const response = await fetch(photo.src);
                const blob = await response.blob();
                const file = new File([blob], 'photo.' + ((blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')), { type: blob.type || 'image/jpeg' });
                return window.MyMaintenancePhotos.upload(assetId, assetType, file, photo.text || '');
            }));
            storedPhotos = storedPhotos.concat(uploaded);
        } catch (error) {
            console.error('Could not upload photos:', error);
            window.MyMaintenanceCommonUi.alert('Could not upload the photos. Please try again.');
            return;
        }
        photos = buildPhotos();
        currentIndex = Math.max(0, photos.length - pendingPhotos.length);
        syncPhotoPresentation();
        closeAddPhotos();
        openGallery();
    });

    if (window.MyMaintenancePhotos && assetId) {
        window.MyMaintenancePhotos.list(assetId, assetType).then(function (remotePhotos) {
            storedPhotos = remotePhotos;
            photos = buildPhotos();
            syncPhotoPresentation();
            renderGallery();
        }).catch(function (error) {
            console.error('Could not load photos:', error);
        });
    }

    document.addEventListener('keydown', (event) => {
        if (deletePopup && deletePopup.style.display === 'flex') {
            if (event.key === 'Escape') deletePopup.style.display = 'none';
        } else if (addPopup && addPopup.style.display === 'flex') {
            if (event.key === 'Escape') closeAddPhotos();
        } else if (editPopup && editPopup.style.display === 'flex') {
            if (event.key === 'Escape') closeEditPhoto();
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
        }
    });

    syncPhotoPresentation();
    renderThumbs();
});
