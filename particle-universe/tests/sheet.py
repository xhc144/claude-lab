import sys
from PIL import Image
names=sys.argv[2].split(','); out=sys.argv[1]; cols=int(sys.argv[3]) if len(sys.argv)>3 else 2
ims=[Image.open(f'test-output/engine/{n}.png').convert('RGB') for n in names]
w,h=ims[0].size; sc=0.5
tw,th=int(w*sc),int(h*sc)
rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(tw*cols,th*rows))
for i,im in enumerate(ims): sheet.paste(im.resize((tw,th),Image.LANCZOS),((i%cols)*tw,(i//cols)*th))
sheet.save(out)
