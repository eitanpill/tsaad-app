import { removePhotoFixtures } from "./photo-fixtures";

export default function globalTeardown() {
  removePhotoFixtures();
}
