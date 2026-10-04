using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class StayBounded : MonoBehaviour
{
    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        transform.position = new Vector3(Mathf.Clamp(transform.position.x, -301.5f, 302f), Mathf.Clamp(transform.position.y, -149.8f, 148.23f), transform.position.z);
    }
}
