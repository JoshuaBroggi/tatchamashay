// The editor and renderer both read these named, non-overlapping areas from the manifest.
const region = (id, name, parts) => ({ id, name, parts });
export const PAINT_REGIONS = {
  octopus: [region('head', 'Head', ['Head']), region('arms', 'Eight arms', ['Arms']), region('spots', 'Spots', ['Spots'])],
  clam: [region('top', 'Top shell', ['ShellTop']), region('bottom', 'Bottom shell', ['ShellBottom'])],
  parrot: [region('body', 'Head & body', ['Head', 'Body']), region('wings', 'Wings', ['WingLeftFeathers', 'WingRightFeathers']), region('tail', 'Tail', ['Tail'])],
  crown: [region('band', 'Band', ['Band']), region('points', 'Points', ['Points']), region('rim', 'Rim', ['Rim'])],
  'star-compass': [region('star', 'Star', ['Star']), region('loop', 'Loop', ['Loop'])],
  potion: [region('liquid', 'Potion', ['Liquid']), region('cork', 'Cork & string', ['Cork', 'String']), region('heart', 'Heart tag', ['Heart'])],
  'dragon-egg': [region('shell', 'Egg shell', ['Shell']), region('spots', 'Speckles', ['Speckles'])],
  turtle: [region('shell', 'Shell', ['Shell']), region('head', 'Head', ['HeadSkin']), region('flippers', 'Flippers & tail', ['FlipperFrontLeftSkin', 'FlipperFrontRightSkin', 'FlipperBackLeftSkin', 'FlipperBackRightSkin', 'TailTip'])],
  doubloon: [region('face', 'Coin', ['Face']), region('rim', 'Rim', ['Rim']), region('stamp', 'Stamp', ['Stamp'])],
  spider: [region('abdomen', 'Abdomen', ['Abdomen']), region('head', 'Head & chest', ['Head']), region('legs', 'Eight legs', ['Legs'])],
};
