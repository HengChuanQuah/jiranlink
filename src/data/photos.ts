// Township photos for the home hero and township cards. They load from Sime Darby Property's public website
// (hot-linked, not copied into this repo). If a photo can't load, the drawn aerial pattern shows instead.
// Credit: Sime Darby Property. Replace with the team's own photos or the official media kit before any public launch.

export interface TownshipPhoto {
  wide: string;
  tall?: string; // narrower crop for phones
  credit: string;
}

const SDP = "https://www.simedarbyproperty.com";

export const TOWNSHIP_PHOTOS: Record<string, TownshipPhoto> = {
  elmina: { wide: `${SDP}/city-of-elmina/images/coe-banner-w.jpg`, tall: `${SDP}/city-of-elmina/images/coe-m.jpg`, credit: "Sime Darby Property" },
  melawati: { wide: `${SDP}/sites/default/files/2018-03/melawati-fb.jpg`, credit: "Sime Darby Property" },
  kleast: { wide: `${SDP}/home/images/ts-kleast.jpg`, credit: "Sime Darby Property" },
};

/** Smaller shots used on the township cards. */
export const TOWNSHIP_CARD_PHOTOS: Record<string, string> = {
  elmina: `${SDP}/home/images/ts-coe.jpg?v2`,
  melawati: `${SDP}/sites/default/files/2018-03/melawati-fb.jpg`,
  kleast: `${SDP}/home/images/ts-kleast.jpg`,
};
