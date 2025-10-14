(function() {
  // Ambil parameter dari URL (misal ?size=300x250)
  const query = new URLSearchParams(window.location.search);
  const size = query.get("size") || "300x250";

  // Daftar iklan berdasarkan ukuran
  const ads = {
    "160x600": {
      img: "https://domainlu.com/ads/160x600.png",
      link: "https://contoh-vertikal.com"
    },
    "300x250": {
      img: "https://domainlu.com/ads/300x250.png",
      link: "https://contoh-persegi.com"
    },
    "728x90": {
      img: "https://domainlu.com/ads/728x90.png",
      link: "https://contoh-banner.com"
    }
  };

  // Cek apakah ukuran valid
  const ad = ads[size] || ads["300x250"];
  const [width, height] = size.split("x");

  // Bikin container
  const adContainer = document.createElement("div");
  adContainer.style.textAlign = "center";
  adContainer.style.margin = "20px auto";
  adContainer.style.padding = "10px";
  adContainer.style.background = "rgba(255,255,255,0.05)";
  adContainer.style.border = "1px solid rgba(255,255,255,0.1)";
  adContainer.style.borderRadius = "10px";
  adContainer.style.width = width + "px";
  adContainer.style.height = height + "px";
  adContainer.style.overflow = "hidden";

  // Isi banner
  adContainer.innerHTML = `
    <a href="${ad.link}" target="_blank">
      <img src="${ad.img}" alt="Iklan" 
        style="width:${width}px;height:${height}px;
               object-fit:cover;border-radius:10px;">
    </a>
  `;

  // Masukkan ke halaman
  document.body.appendChild(adContainer);
})();