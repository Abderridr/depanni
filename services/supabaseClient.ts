import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vxqfueztgkjgognnyubb.supabase.co';
const supabaseKey = 'sb_publishable_o3zRBbsvdXZiDwPEv-XrUA_wKv4Lopx';

export const supabase = createClient(supabaseUrl, supabaseKey);