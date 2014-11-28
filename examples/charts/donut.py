import pandas as pd
from collections import OrderedDict

from bokeh.sampledata.olympics2014 import data
from bokeh.charts import Donut

# we throw the data into a pandas df
df = pd.io.json.json_normalize(data['data'])
# filter by countries with at least one medal and sort
df = df[df['medals.total'] > 8]
df = df.sort("medals.total", ascending=False)

# then, we get the countries and we group the data by medal type
countries = df.abbr.values.tolist()
gold = df['medals.gold'].astype(float).values
silver = df['medals.silver'].astype(float).values
bronze = df['medals.bronze'].astype(float).values

# later, we build a dict containing the grouped data
medals = OrderedDict(bronze=bronze, silver=silver, gold=gold)

# any of the following commented are valid Bar inputs
#medals = pd.DataFrame(medals).T.values
#medals = list(medals.values())
#medas = pd.DataFrame(medals)

donut = Donut(medals, countries, filename="donut.html")
donut.title("Medals Donut").xlabel("countries").ylabel("medals")
donut.legend(True).width(800).height(800).show()
