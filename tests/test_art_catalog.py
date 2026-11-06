import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('art_catalog', Path(__file__).resolve().parents[1] / 'scripts/refresh-art-catalog.py')
art = importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)


class ArtCatalogTests(unittest.TestCase):
    def test_source_eligibility_and_real_dimensions(self):
        item = {'id': 1, 'share_license_status': 'CC0', 'type': 'Painting',
                'accession_number': '1900.123', 'images': {'web': {'url': 'https://openaccess-cdn.clevelandart.org/1900.123/1900.123_web.jpg', 'width': '1364', 'height': '1000'}}}
        self.assertIsNotNone(art.normalize(item))
        for change in [{'share_license_status': 'Copyrighted'}, {'type': 'Vessel'}, {'images': {'web': {'width': 1000, 'height': 1500}}}, {'accession_number': '../image'}]:
            self.assertIsNone(art.normalize({**item, **change}))


if __name__ == '__main__':
    unittest.main()
