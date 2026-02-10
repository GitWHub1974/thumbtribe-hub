
DROP POLICY IF EXISTS "Service can insert profiles" ON public.profiles;

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (id = auth.uid());
