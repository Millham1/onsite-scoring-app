import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hmbxboegkgwoovbtozjg.supabase.co";
const supabaseKey = "sb_publishable_NkwvYX4A9oasfbM2ZmEFjg_vSF9kFZt";

export const supabase = createClient(supabaseUrl, supabaseKey);