"""Regression checks for preserving reviewed English during manuscript revisions."""
import copy
import unittest
from slr_translation import plan, load, SOURCE, BASE, PACK, glossary_errors, GLOSSARY
from i18n_apply_glossary import localize
from i18n_project import BOOK


class TranslationRevisionTests(unittest.TestCase):
    def setUp(self):
        self.source = load(SOURCE)
        self.base = load(BASE)
        self.pack = load(PACK)

    def test_unchanged_text_and_new_art_keep_all_english(self):
        self.source['cards'][0]['cgDark'] = not self.source['cards'][0]['cgDark']
        builder, draft = plan(self.source, self.base, self.pack)
        self.assertEqual(builder.todo, [])
        localize(draft, self.source, load(BOOK / 'i18n/glossary.json'), 'en')
        expected = copy.deepcopy(self.pack)
        expected['cards'][0]['cgDark'] = self.source['cards'][0]['cgDark']
        self.assertEqual(draft, expected)

    def test_one_chinese_paragraph_only_requests_that_revision(self):
        self.source['cards'][7]['segments'][1]['text'] += '她又看了看窗外。'
        builder, _ = plan(self.source, self.base, self.pack)
        self.assertEqual([x['path'] for x in builder.todo], ['/cards/7/segments/1/text'])
        self.assertEqual(builder.todo[0]['ref'], self.pack['cards'][7]['segments'][1]['text'])

    def test_card_reordering_uses_identity_not_old_array_position(self):
        self.source['cards'].reverse()
        builder, draft = plan(self.source, self.base, self.pack)
        self.assertEqual(builder.todo, [])
        by_id = {c['id']: c for c in self.pack['cards']}
        for card in draft['cards']:
            self.assertEqual(card['segments'], by_id[card['id']]['segments'])

    def test_inserted_segment_does_not_shift_neighboring_translation(self):
        added = {'kind': 'narration', 'text': '一阵风从窗外吹了进来。'}
        self.source['cards'][0]['segments'].insert(1, added)
        builder, draft = plan(self.source, self.base, self.pack)
        self.assertEqual([x['path'] for x in builder.todo], ['/cards/0/segments/1/text'])
        self.assertEqual(draft['cards'][0]['segments'][2:], self.pack['cards'][0]['segments'][1:])

    def test_english_editorial_change_is_retained(self):
        self.pack['cards'][2]['segments'][0]['text'] += ' A reviewed editorial adjustment.'
        builder, draft = plan(self.source, self.base, self.pack)
        self.assertEqual(builder.todo, [])
        self.assertEqual(draft['cards'][2]['segments'], self.pack['cards'][2]['segments'])

    def test_frame_and_music_are_only_retranslated_when_changed(self):
        self.source['frame']['levelIntro']['1'][1]['text'] += '他的疑问仍未平息。'
        self.source['assets']['bgm'][0]['title'] = '山谷的清晨'
        builder, _ = plan(self.source, self.base, self.pack)
        self.assertEqual({x['path'] for x in builder.todo}, {
            '/frame/levelIntro/1/1/text', '/assets/bgm/0/title'})

    def test_renamed_person_requires_glossary_review(self):
        self.source['entries']['e_pepita']['name'] = '佩皮塔的新译名'
        self.assertTrue(any('e_pepita' in e for e in glossary_errors(self.source, load(GLOSSARY))))

    def test_missing_english_name_cannot_silently_fall_back(self):
        glossary = load(GLOSSARY)
        glossary['entries']['e_pepita']['en'] = ''
        self.assertTrue(any('e_pepita' in e for e in glossary_errors(self.source, glossary)))


if __name__ == '__main__':
    unittest.main()
