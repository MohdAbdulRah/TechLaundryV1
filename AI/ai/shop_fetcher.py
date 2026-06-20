import requests
from langchain.docstore.document import Document


def fetch_shop_data(api_url):

    response = requests.get(api_url)

    response.raise_for_status()

    data = response.json()

    return data.get("data", [])


def convert_to_documents(shops):

    docs = []

    for shop in shops:

        services_text = ""

        for service in shop.get("prices", []):

            category = service.get("category")

            if isinstance(category, dict):
                category = category.get("name")

            service_text = f"""
            Service Name: {service.get('name')}
            Charge: ₹{service.get('charge')}
            Category: {category}
            Times Ordered: {service.get('timesOrdered')}
            Average Review: {service.get('avgReview')}
            Express Available: {service.get('expressAvailable')}
            """

            services_text += service_text + "\n"

        text = f"""
        Shop Name: {shop.get('name')}

        Address: {shop.get('address')}

        Rating: {shop.get('rating')}

        Total Orders: {shop.get('totalOrders')}

        Average Delivery Time: {shop.get('avgDeliveryTime')} minutes

        Success Rate: {shop.get('successRate')}%

        Services:
        {services_text}
        """

        docs.append(
            Document(
                page_content=text,
                metadata={
                    "shop_id": str(shop.get("_id")),
                    "shop_name": shop.get("name")
                }
            )
        )

    return docs