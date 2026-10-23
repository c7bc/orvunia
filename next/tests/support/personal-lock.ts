import { personalProfile } from "../../apps/personal/profile.ts";
const directory = process.argv[2];
if (!directory || !process.connected)
  throw Error("Isolated lock test requires its parent");
personalProfile(directory);
process.send?.({ type: "profile_locked" });
setInterval(() => {}, 1000);
