"""Local deterministic tests; none certifies mathematics or model behavior."""
from __future__ import annotations
import contextlib,copy,io,json,subprocess,sys,tempfile,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from audit_lecture import audit_text,main as lint_main
from check_project import validate,check_files
from build_utils import sha256,build
from artifact_records import verify_records
from lecture_tools import prepare,snapshot
from pdf_artifacts import render_pdf

def doc(body):return '\\documentclass{article}\n\\begin{document}\n'+body+'\n\\end{document}\n'
class ProseTests(unittest.TestCase):
    def test_gap_advisory_only(self):
        r=audit_text('显然可得.');self.assertTrue(r['findings']);self.assertFalse(r['mathematical_verification']);self.assertNotIn('passed',r)
    def test_comments_ignored(self):self.assertFalse(audit_text(doc('% 证明略\n正文'),True)['findings'])
    def test_verbatim_ignored(self):self.assertFalse(audit_text(doc(r'\verb|证明略|'),True)['findings'])
    def test_preamble_ignored(self):self.assertFalse(audit_text('\\newcommand{\\fake}{证明略}\n'+doc('正文'),True)['findings'])
    def test_fenced_code_ignored(self):self.assertFalse(audit_text('```tex\n证明略\n```\n解释')['findings'])
    def test_steps_not_banned(self):self.assertFalse(audit_text('第一步：构造.\n第二步：代入.')['findings'])
    def test_short_manuscript_no_quota(self):self.assertFalse(audit_text('定义 $x=1$.')['findings'])
    def test_long_proof_no_length_rejection(self):self.assertFalse(audit_text(doc('这一计算可按定义核对. '*110),True)['findings'])
    def test_multifile_line_mapping(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);(root/'main.tex').write_text(doc(r'\input{part}'),encoding='utf-8');(root/'part.tex').write_text('解释.\n证明略\n',encoding='utf-8')
            out=io.StringIO()
            with contextlib.redirect_stdout(out):code=lint_main([str(root/'main.tex'),'--json'])
            self.assertEqual(code,0);r=json.loads(out.getvalue());item=next(x for x in r['findings'] if x['code']=='placeholder');self.assertEqual((item['file'],item['line']),('part.tex',2))

class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.tex=self.root/'main.tex';self.tex.write_text(doc(r'\label{claim:one} x=x.'),encoding='utf-8')
        bind={'path':'main.tex','sha256':sha256(self.tex)}
        self.data={'schema_version':2,'scope':{'topic':'test fixture','audience':'test only','status':'complete','units':[{'id':'u1','status':'complete','goal':'fixture'}]},'review_snapshot':[bind.copy()],'sources':[],
         'claims':[{'id':'c1','statement':'x=x','central':True,'proof_required':True,'bottleneck':'fixture','dependencies':[],'support':{'kind':'local_proof','path':'main.tex','marker':r'\label{claim:one}'},'review':{'status':'pass','note':'Test fixture, not a real human review.'}}],
         'figures':[],'reviews':{k:{'status':'pass','note':'Test fixture only.','reviewer':'fixture'} for k in ('mathematics','pedagogy','sources','visuals','layout','delivery')},'deliverables':[bind.copy()]}
    def tearDown(self):self.tmp.cleanup()
    def check(self):return validate(self.root,self.data)
    def refresh(self):
        for key in ('review_snapshot','deliverables'):self.data[key][0]['sha256']=sha256(self.tex)
    def test_valid_ledger_not_mathematical_proof(self):r=self.check();self.assertTrue(r['mechanical_checks_passed'],r);self.assertFalse(r['mathematical_verification'])
    def test_top_array_rejected(self):self.assertFalse(validate(self.root,[])['mechanical_checks_passed'])
    def test_boolean_schema_rejected(self):self.data['schema_version']=True;self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_stale_snapshot(self):self.tex.write_text(doc('changed'));self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_comment_label_not_proof(self):self.tex.write_text(doc('% \\label{claim:one}\nx=x.'));self.refresh();self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_literal_label_not_proof(self):self.tex.write_text(doc(r'\verb|\label{claim:one}|'));self.refresh();self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_offline_source_accepted(self):
        self.data['sources']=[{'id':'s1','title':'Fixture book','authors':['Author'],'publication':'Publisher, 2001','locator':'Chapter 1, p. 2','accessed_on':'2026-09-24','read_level':'relevant_sections'}];self.assertTrue(self.check()['mechanical_checks_passed'],self.check())
    def test_use_only_core_with_scope(self):
        c=self.data['claims'][0];c.update(proof_required=False,proof_scope_reason='Actual task treats this as a previously learned theorem.',support={'kind':'prerequisite','reader_basis':'Explicitly supplied reader background.'});self.assertTrue(self.check()['mechanical_checks_passed'],self.check())
    def test_core_without_scope_rejected(self):
        c=self.data['claims'][0];c.update(proof_required=False,support={'kind':'prerequisite','reader_basis':'Given'});self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_required_proof_cannot_be_external(self):
        c=self.data['claims'][0];c['support']={'kind':'prerequisite','reader_basis':'Given'};self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_cycle_rejected(self):self.data['claims'][0]['dependencies']=['c1'];self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_unknown_dependency(self):self.data['claims'][0]['dependencies']=['missing'];self.assertFalse(self.check()['mechanical_checks_passed'])
    def test_no_admin_record_light_mode(self):
        r=check_files(self.root);self.assertTrue(r['mechanical_checks_passed']);self.assertEqual(r['review_status'],'not_provided');self.assertEqual(r['statuses']['build'],'not_provided')
    def test_nested_main_light_mode(self):
        (self.root/'nested').mkdir();(self.root/'nested/main.tex').write_text(doc('x=x'));self.assertTrue(check_files(self.root,'nested/main.tex')['mechanical_checks_passed'])

class ArtifactTests(unittest.TestCase):
    def setUp(self):
        import fitz
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.tex=self.root/'main.tex';self.tex.write_text(doc('Fixture only.'))
        pdf=self.root/'main.pdf'
        with fitz.open() as d:
            for i in range(3):p=d.new_page();p.insert_text((72,72),f'Test fixture page {i+1}')
            d.save(pdf)
        self.b={'schema_version':1,'status':'built','source':'main.tex','pdf':{'path':'main.pdf','sha256':sha256(pdf)},'inputs':[{'path':'main.tex','sha256':sha256(self.tex)}]}
        self.writeb();render_pdf(pdf,root=self.root,dpi=72);self.r=json.loads((self.root/'main.render.json').read_text())
    def tearDown(self):self.tmp.cleanup()
    def writeb(self):(self.root/'main.build.json').write_text(json.dumps(self.b))
    def writer(self):(self.root/'main.render.json').write_text(json.dumps(self.r))
    def check(self):return verify_records(self.root,'main.build.json','main.render.json')
    def test_actual_files(self):r=self.check();self.assertFalse(r['errors'],r);self.assertEqual(r['page_count'],3);self.assertFalse(r['visual_inspection_verified'])
    def test_last_page_omission(self):self.r['pages'].pop();self.writer();self.assertTrue(self.check()['errors'])
    def test_fake_declared_page_count(self):self.r['page_count']=2;self.writer();self.assertTrue(self.check()['errors'])
    def test_same_png_reuse(self):self.r['pages'][1].update({k:self.r['pages'][0][k] for k in ('path','sha256')});self.writer();self.assertTrue(self.check()['errors'])
    def test_repeated_number(self):self.r['pages'][2]['page']=2;self.writer();self.assertTrue(self.check()['errors'])
    def test_stale_page(self):(self.root/self.r['pages'][0]['path']).write_bytes(b'changed');self.assertTrue(self.check()['errors'])
    def test_nonimage_even_with_hash(self):
        p=self.root/self.r['pages'][0]['path'];p.write_text('not an image');self.r['pages'][0]['sha256']=sha256(p);self.writer();self.assertTrue(self.check()['errors'])
    def test_fake_pdf_header(self):
        p=self.root/'main.pdf';p.write_bytes(b'%PDF-1.7\nnot really a PDF');self.b['pdf']['sha256']=sha256(p);self.writeb();self.r['pdf']['sha256']=sha256(p);self.writer();self.assertTrue(self.check()['errors'])
    def test_source_modified(self):self.tex.write_text(doc('changed'));self.assertTrue(self.check()['errors'])
    def test_failed_build_record(self):self.b['status']='failed';self.writeb();self.assertTrue(self.check()['errors'])
    def test_duplicate_input(self):self.b['inputs'].append(self.b['inputs'][0].copy());self.writeb();self.assertTrue(self.check()['errors'])
    def test_json_not_object(self):(self.root/'main.build.json').write_text('[]');self.assertTrue(self.check()['errors'])
    def test_record_path_escape(self):self.b['pdf']['path']='../main.pdf';self.writeb();self.assertTrue(self.check()['errors'])
    def test_missing_render_not_silent_pass(self):r=verify_records(self.root,'main.build.json',None);self.assertTrue(r['errors'])
    def test_light_uses_real_records(self):self.assertTrue(check_files(self.root)['mechanical_checks_passed'])

class ToolTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.body=self.root/'body.tex';self.body.write_text('说明 $x=x$.',encoding='utf-8')
    def tearDown(self):self.tmp.cleanup()
    def test_prepare_strict_unchanged(self):p=prepare(self.body,self.root/'strict');s=p.read_text();self.assertIn('SimSun',s);self.assertNotIn('@@BODY@@',s);self.assertNotIn('PREVIEW:',s)
    def test_prepare_preview_explicit(self):p=prepare(self.body,self.root/'preview',preview=True);self.assertIn('PREVIEW:',p.read_text());self.assertIn('preview',p.name)
    def test_prepare_ignores_commented_full_document(self):self.body.write_text('% \\documentclass{article}\n正文.');self.assertTrue(prepare(self.body,self.root/'prepared').is_file())
    def test_prepare_no_overwrite(self):
        prepare(self.body,self.root/'strict')
        with self.assertRaises(ValueError):prepare(self.body,self.root/'strict')
    def test_snapshot_fonts_excluded_qa_included(self):
        project=self.root/'project';(project/'.qa').mkdir(parents=True);(project/'main.tex').write_text('x');(project/'fake.otf').write_bytes(b'fake font - test only');(project/'.qa/page.png').write_bytes(b'test image binding')
        target=snapshot(project,self.root/'backup.zip')
        with zipfile.ZipFile(target) as z:self.assertIn('.qa/page.png',z.namelist());self.assertNotIn('fake.otf',z.namelist());self.assertIsNone(z.testzip())
    def test_timeout_records_failure(self):
        tex=self.root/'main.tex';tex.write_text(doc('x'))
        with patch('build_utils.shutil.which',return_value='/test/xelatex'),patch('build_utils.subprocess.run',side_effect=subprocess.TimeoutExpired('xelatex',1)):
            with self.assertRaisesRegex(RuntimeError,'timeout'):build(tex,self.root/'build',timeout=1)
        self.assertEqual(json.loads((self.root/'build/main.build.json').read_text())['status'],'failed')

if __name__=='__main__':unittest.main(verbosity=2)
