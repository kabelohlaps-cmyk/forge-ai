import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Pressable, Text, View, Modal } from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getVerseOfTheDay, type Verse } from '@forge/core';
const { width: SW } = Dimensions.get('window');
export function VerseBalloon(){
  const x=useRef(new Animated.Value(-150)).current;
  const bob=useRef(new Animated.Value(0)).current;
  const [verse,setVerse]=useState<Verse|null>(null);
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    const t=setTimeout(()=>{
      setVerse(getVerseOfTheDay());
      Animated.timing(x,{toValue:SW+150,duration:38000,easing:Easing.linear,useNativeDriver:true}).start();
      Animated.loop(Animated.sequence([
        Animated.timing(bob,{toValue:-6,duration:2000,useNativeDriver:true}),
        Animated.timing(bob,{toValue:0,duration:2000,useNativeDriver:true}),
      ])).start();
    },4500);
    return ()=>clearTimeout(t);
  },[x,bob]);
  if(!verse)return null;
  return (<>
    <Animated.View pointerEvents="box-none" style={{position:'absolute',top:70,zIndex:40,transform:[{translateX:x},{translateY:bob}]}}>
      <Pressable onPress={()=>setOpen(true)} style={{alignItems:'center'}}>
        <BalloonSvg/>
        <View style={{backgroundColor:'rgba(11,43,26,0.85)',borderColor:'rgba(212,166,75,0.5)',borderWidth:1,borderRadius:999,paddingHorizontal:10,paddingVertical:3,marginTop:4}}>
          <Text style={{color:'#F0D48A',fontStyle:'italic',fontSize:11}}>{verse.reference}</Text>
        </View>
      </Pressable>
    </Animated.View>
    <Modal visible={open} transparent animationType="fade">
      <Pressable onPress={()=>setOpen(false)} style={{flex:1,backgroundColor:'rgba(11,43,26,0.85)',alignItems:'center',justifyContent:'center',padding:24}}>
        <View style={{backgroundColor:'#1E4D2B',borderColor:'rgba(212,166,75,0.4)',borderWidth:1,borderRadius:20,padding:28,maxWidth:420}}>
          <Text style={{color:'#F5EFE0',fontSize:20,fontStyle:'italic',textAlign:'center',lineHeight:30,fontFamily:'serif'}}>"{verse.text}"</Text>
          <Text style={{color:'#D4A64B',textAlign:'center',marginTop:20,letterSpacing:2,fontSize:12}}>— {verse.reference} —</Text>
          <Pressable onPress={()=>setOpen(false)} style={{marginTop:24,alignItems:'center'}}>
            <Text style={{color:'#F0D48A',fontSize:13}}>Amen</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  </>);
}
function BalloonSvg(){
  return (<Svg width={54} height={76} viewBox="0 0 64 90">
    <Defs><LinearGradient id="mb" x1="0" y1="0" x2="0" y2="1"><Stop offset="0%" stopColor="#F0D48A"/><Stop offset="55%" stopColor="#D4A64B"/><Stop offset="100%" stopColor="#E08A5C"/></LinearGradient></Defs>
    <Path d="M32 4 C 14 4, 6 18, 6 32 C 6 46, 18 54, 28 58 L 36 58 C 46 54, 58 46, 58 32 C 58 18, 50 4, 32 4 Z" fill="url(#mb)" stroke="#3A352C" strokeWidth="1"/>
    <Path d="M28 58 L 27 68 M36 58 L 37 68" stroke="#6B6357" strokeWidth="0.8"/>
    <Rect x="24" y="68" width="16" height="10" rx="2" fill="#6B6357"/>
  </Svg>);
}
