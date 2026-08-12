// js/app.js
window.pindahLayar = function(idTujuan) {
  const screens = ['screen-login', 'screen-register', 'screen-camera', 'screen-dashboard'];
  
  screens.forEach(screen => {
    document.getElementById(screen).classList.add('hidden');
    document.getElementById(screen).classList.remove('flex');
  });

  document.getElementById(idTujuan).classList.remove('hidden');
  document.getElementById(idTujuan).classList.add('flex');

  // Panggil fungsi kamera jika ke layar kamera
  if (idTujuan === 'screen-camera' && window.mulaiKamera) {
    window.mulaiKamera();
  } else if (window.matikanKamera) {
    window.matikanKamera();
  }
};

window.pindahTab = function(idTab) {
  const tabs = ['tab-home', 'tab-profil', 'tab-riwayat', 'tab-admin-acc', 'tab-superuser'];
  
  tabs.forEach(tab => {
    document.getElementById(tab).classList.add('hidden');
  });

  document.getElementById(idTab).classList.remove('hidden');

  // Muat ulang data saat tab diklik
  if(idTab === 'tab-profil' && window.muatDataProfil) window.muatDataProfil();
  if(idTab === 'tab-riwayat' && window.muatDataRiwayat) window.muatDataRiwayat();
  if(idTab === 'tab-admin-acc' && window.muatDataAdminACC) window.muatDataAdminACC();
  if(idTab === 'tab-superuser' && window.muatDataSuperUser) window.muatDataSuperUser();
};
