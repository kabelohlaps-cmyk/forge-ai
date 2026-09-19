import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { VerseBalloon } from '../components/VerseBalloon';
export default function RootLayout(){
  return (<>
    <StatusBar style="light"/>
    <Stack screenOptions={{headerStyle:{backgroundColor:'#0B2B1A'},headerTintColor:'#F0D48A',headerTitleStyle:{fontFamily:'serif'}}}/>
    <VerseBalloon/>
  </>);
}
