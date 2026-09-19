export interface Verse { id:string; text:string; reference:string; theme:'creation'|'wisdom'|'craft'|'rest'|'light' }
export const VERSES: Verse[] = [
  {id:'gen-1-1',theme:'creation',reference:'Genesis 1:1',text:'In the beginning God created the heavens and the earth.'},
  {id:'gen-1-27',theme:'creation',reference:'Genesis 1:27',text:'So God created mankind in his own image, in the image of God he created them.'},
  {id:'gen-2-15',theme:'craft',reference:'Genesis 2:15',text:'The Lord God took the man and put him in the Garden of Eden to work it and take care of it.'},
  {id:'prov-8-12',theme:'wisdom',reference:'Proverbs 8:12',text:'I, wisdom, dwell together with prudence; I possess knowledge and discretion.'},
  {id:'prov-22-29',theme:'craft',reference:'Proverbs 22:29',text:'Do you see someone skilled in their work? They will serve before kings.'},
  {id:'ex-31-3',theme:'craft',reference:'Exodus 31:3',text:'I have filled him with the Spirit of God, with wisdom, with understanding, with knowledge and with all kinds of skills.'},
  {id:'psalm-19-1',theme:'light',reference:'Psalm 19:1',text:'The heavens declare the glory of God; the skies proclaim the work of his hands.'},
  {id:'psalm-90-17',theme:'craft',reference:'Psalm 90:17',text:'May the favor of the Lord our God rest on us; establish the work of our hands.'},
  {id:'psalm-127-1',theme:'rest',reference:'Psalm 127:1',text:'Unless the Lord builds the house, the builders labor in vain.'},
  {id:'isa-64-8',theme:'craft',reference:'Isaiah 64:8',text:'We are the clay, you are the potter; we are all the work of your hand.'},
  {id:'jer-29-11',theme:'wisdom',reference:'Jeremiah 29:11',text:'For I know the plans I have for you, plans to prosper you and not to harm you.'},
  {id:'matt-5-14',theme:'light',reference:'Matthew 5:14',text:'You are the light of the world. A city set on a hill cannot be hidden.'},
  {id:'john-1-3',theme:'creation',reference:'John 1:3',text:'Through him all things were made; without him nothing was made that has been made.'},
  {id:'col-3-23',theme:'craft',reference:'Colossians 3:23',text:'Whatever you do, work at it with all your heart, as working for the Lord.'},
  {id:'eccl-3-11',theme:'rest',reference:'Ecclesiastes 3:11',text:'He has made everything beautiful in its time.'},
];
export function getVerseOfTheDay(date: Date = new Date()): Verse {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return VERSES[dayOfYear % VERSES.length];
}
