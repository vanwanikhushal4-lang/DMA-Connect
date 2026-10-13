import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { api } from '../services/api';
import { useSession } from '../context/SessionContext';
import { colors, fonts } from '../theme';
export function PersonPhoto({ personId, path, name, size = 48, requestId }: { personId: string; path?: string; name: string; size?: number; requestId?: string }) {
  const { user } = useSession();
  const uid = user?.uid;
  const [photo, setPhoto] = useState({ uid: '', path: '', uri: '' });
  useEffect(() => {
    let active = true;
    if (path && uid) void api<{ uri: string }>('getPhoto', { personId, path, thumbnail: size < 100, ...(requestId ? { requestId } : {}) }).then(r => { if (active) setPhoto({ uid, path, uri: r.uri }); }).catch(() => {});
    return () => { active = false; };
  }, [path, personId, uid, size, requestId]);
  const uri = photo.uid === uid && photo.path === path ? photo.uri : '';
  const style = { width: size, height: size, borderRadius: size > 100 ? 18 : size / 2 };
  if (uri) return <Image source={{ uri }} style={style} accessibilityLabel={`${name} photograph`} />;
  return <View style={[style, { backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontFamily: fonts.semibold, color: colors.purple, fontSize: size / 3 }}>{name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}</Text></View>;
}
