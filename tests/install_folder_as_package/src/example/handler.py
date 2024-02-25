import requests
from example.helper import helper

def hello(event, context):
    return_data = requests.get('https://httpbin.org/get').json()
    return_data["test"] = helper()
    return return_data
