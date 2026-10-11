// Contact details shown on the site. Email and exact address are still placeholders.
export const CONTACT = {
  phone: '+84 91 539 32 82',
  phoneHref: 'tel:+84915393282',
  facebook: 'https://www.facebook.com/chillvillaredsun',
  facebookLabel: 'Chill Villa RedSun',
  email: 'hello@redsun.example',
  address: 'Hải Phòng, Việt Nam',
  // Map search text: change to the full street address when it's ready.
  mapQuery: 'Hải Phòng, Việt Nam',
};

export const mapEmbedUrl = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=12&output=embed`;
export const mapLinkUrl = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
